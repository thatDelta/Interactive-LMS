# backend/main.py
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import execute_query
from pydantic import BaseModel
from typing import Optional
from auth import create_access_token, get_current_user, role_required
import json, os, uuid
from datetime import datetime

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="EDUFLOW Backend API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ─── Auth ─────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = execute_query(
        "SELECT id, name, role, registration_number, password_hash FROM Users WHERE email = %s",
        (req.email,), fetch_one=True
    )
    if not user or user["password_hash"] != req.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"id": user["id"], "role": user["role"], "name": user["name"]})
    return {"access_token": token, "role": user["role"], "user_id": user["id"], "name": user["name"]}

# ─── Helper: Get faculty's course IDs ────────────────────
def get_faculty_course_ids(faculty_id: int):
    rows = execute_query("SELECT id FROM Courses WHERE faculty_id=%s", (faculty_id,))
    return [r["id"] for r in rows]

# ─── CGPA Computation ────────────────────────────────────
def compute_student_cgpa(student_id: int):
    courses = execute_query("""
        SELECT c.id, c.name, c.code, c.credits, e.attended_classes, e.total_classes, e.eligibility, e.attendance_percentage
        FROM Enrollments e JOIN Courses c ON e.course_id = c.id
        WHERE e.student_id = %s
    """, (student_id,))
    total_credits = 0
    total_gp_credits = 0
    course_details = []
    for c in courses:
        quizzes = execute_query("""
            SELECT q.id, q.weightage, q.max_marks, qs.marks_obtained
            FROM Quizzes q LEFT JOIN Quiz_Scores qs ON q.id = qs.quiz_id AND qs.student_id = %s
            WHERE q.course_id = %s
        """, (student_id, c["id"]))
        total_available_weight = 0.0
        final_percentage = 0.0
        for q in quizzes:
            marks = float(q["marks_obtained"] or 0)
            mx = float(q["max_marks"] or 100)
            wt = float(q["weightage"] or 0)
            if mx > 0:
                final_percentage += (marks / mx) * wt
                total_available_weight += wt
        if total_available_weight > 0:
            final_percentage = (final_percentage / total_available_weight) * 100.0
        gp = 0
        if final_percentage >= 95: gp = 10
        elif final_percentage >= 90: gp = 9
        elif final_percentage >= 80: gp = 8
        elif final_percentage >= 70: gp = 7
        elif final_percentage >= 60: gp = 6
        elif final_percentage >= 50: gp = 5
        else: gp = 0
        total_gp_credits += (gp * c["credits"])
        total_credits += c["credits"]
        course_details.append({
            "course_id": c["id"], "course_code": c["code"], "course_name": c["name"],
            "credits": c["credits"], "final_percentage": round(final_percentage, 2),
            "grade_point": gp, "eligibility": c["eligibility"],
            "attendance_percentage": float(c["attendance_percentage"])
        })
    cgpa = round(total_gp_credits / total_credits, 2) if total_credits > 0 else 0.0
    return {"cgpa": cgpa, "course_metrics": course_details}

# ─── Analysis ────────────────────────────────────────────
@app.get("/api/me/analysis")
def get_my_analysis(user: dict = Depends(role_required(["student"]))):
    return compute_student_cgpa(user["id"])

@app.get("/api/admin/analysis")
def get_admin_analysis(user: dict = Depends(role_required(["admin", "faculty"]))):
    if user["role"] == "admin":
        students = execute_query("SELECT id, name, registration_number FROM Users WHERE role='student'")
    else:
        cids = get_faculty_course_ids(user["id"])
        if not cids:
            return {"data": [], "total": 0}
        placeholders = ",".join(["%s"] * len(cids))
        students = execute_query(f"""
            SELECT DISTINCT u.id, u.name, u.registration_number
            FROM Users u JOIN Enrollments e ON u.id = e.student_id
            WHERE e.course_id IN ({placeholders}) AND u.role='student'
        """, tuple(cids))
    analysis = []
    for s in students:
        data = compute_student_cgpa(s["id"])
        data.update({"id": s["id"], "name": s["name"], "registration_number": s["registration_number"]})
        analysis.append(data)
    return {"data": analysis, "total": len(analysis)}

# ─── Student Quizzes ─────────────────────────────────────
@app.get("/api/me/quizzes")
def get_accessible_quizzes(user: dict = Depends(role_required(["student"]))):
    quizzes = execute_query("""
        SELECT q.*, c.name as course_name
        FROM Quizzes q JOIN Courses c ON q.course_id = c.id
        JOIN Enrollments e ON e.course_id = c.id
        WHERE e.student_id = %s AND e.eligibility = 'Eligible'
    """, (user["id"],))
    for q in quizzes:
        if isinstance(q["questions_json"], str):
            q["questions_json"] = json.loads(q["questions_json"])
    return quizzes

class SubmitQuizReq(BaseModel):
    answers: dict

@app.post("/api/me/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: int, req: SubmitQuizReq, user: dict = Depends(role_required(["student"]))):
    chk = execute_query("""
        SELECT e.eligibility, q.questions_json, q.max_marks
        FROM Enrollments e JOIN Quizzes q ON q.course_id = e.course_id
        WHERE e.student_id = %s AND q.id = %s
    """, (user["id"], quiz_id), fetch_one=True)
    if not chk or chk["eligibility"] == "Debarred":
        raise HTTPException(status_code=403, detail="Debarred from taking assessment")
    q_data = chk["questions_json"]
    if isinstance(q_data, str):
        q_data = json.loads(q_data)
    score = 0
    total = len(q_data)
    for qkey, qobj in q_data.items():
        if isinstance(qobj, dict) and "answer" in qobj:
            stu_ans = req.answers.get(qkey, "")
            if stu_ans and stu_ans.strip().lower() == qobj["answer"].strip().lower():
                score += 1
    marks_obtained = (score / total) * float(chk["max_marks"]) if total > 0 else 0
    execute_query("""
        INSERT INTO Quiz_Scores (quiz_id, student_id, marks_obtained) VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE marks_obtained=%s
    """, (quiz_id, user["id"], marks_obtained, marks_obtained), commit=True)
    return {"detail": "Submitted", "score": marks_obtained, "percentage": round((score/total)*100,2) if total>0 else 0}

# ─── Attendance Override ─────────────────────────────────
@app.post("/api/faculty/enrollment/{enroll_id}/attendance")
def override_attendance(enroll_id: int, attended: int, user: dict = Depends(role_required(["admin", "faculty"]))):
    enroll = execute_query("SELECT total_classes FROM Enrollments WHERE id=%s", (enroll_id,), fetch_one=True)
    if not enroll: return
    tot = float(enroll["total_classes"])
    pct = (attended / tot * 100) if tot > 0 else 0
    elig = "Eligible" if pct >= 75 else "Debarred"
    execute_query("UPDATE Enrollments SET attended_classes=%s, attendance_percentage=%s, eligibility=%s WHERE id=%s",
                 (attended, pct, elig, enroll_id), commit=True)
    return {"detail": "Updated"}

# ─── Students CRUD (scoped) ──────────────────────────────
@app.get("/api/students")
def get_students(skip: int = 0, limit: int = 10, q: str = "", user: dict = Depends(get_current_user)):
    # Give faculty global student visibility so they can find IDs to enroll
    if user["role"] in ["admin", "faculty"]:
        query = "SELECT id, registration_number, name, email, birth_year, role FROM Users WHERE role='student'"
        params = ()
    else:
        return {"data": [], "total": 0}
        
    if q and q != "undefined":
        query += " AND (LOWER(name) LIKE LOWER(%s) OR LOWER(registration_number) LIKE LOWER(%s))"
        params += (f"%{q}%", f"%{q}%")
        
    count_query = query.replace("SELECT id, registration_number, name, email, birth_year, role", "SELECT COUNT(*) as total")
    total = execute_query(count_query, params, fetch_one=True)["total"]
    
    query += " LIMIT %s OFFSET %s"
    params += (limit, skip)
    rows = execute_query(query, params)
    return {"data": rows, "total": total}

@app.post("/api/students")
def insert_student(req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    try: birth = int(req.get("birth_year")) if str(req.get("birth_year", "")).strip() else 2005
    except ValueError: birth = 2005
    
    execute_query(
        "INSERT INTO Users (registration_number, email, name, password_hash, birth_year, role) VALUES (%s,%s,%s,%s,%s,%s)",
        (req.get("registration_number",""), req.get("email",""), req.get("name",""),
         req.get("password_hash","password123"), birth, req.get("role","student")),
        commit=True)
    return {"status": "inserted"}

@app.put("/api/students/{item_id}")
def update_student(item_id: int, req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    try: birth = int(req.get("birth_year")) if str(req.get("birth_year", "")).strip() else 2005
    except ValueError: birth = 2005
    
    execute_query(
        "UPDATE Users SET registration_number=%s, name=%s, email=%s, birth_year=%s, role=%s WHERE id=%s",
        (req.get("registration_number"), req.get("name"), req.get("email"),
         birth, req.get("role","student"), item_id),
        commit=True)
    return {"status": "updated"}

@app.delete("/api/students/{item_id}")
def delete_student(item_id: int):
    execute_query("DELETE FROM Users WHERE id=%s", (item_id,), commit=True)
    return {"status": "deleted"}

# ─── Courses CRUD (scoped) ───────────────────────────────
@app.get("/api/courses")
def get_courses(skip: int = 0, limit: int = 10, q: str = "", user: dict = Depends(get_current_user)):
    # 1. Admin gets everything
    if user["role"] == "admin":
        query = "SELECT * FROM Courses"
        params = ()
    # 2. Faculty gets only courses they are assigned to
    elif user["role"] == "faculty":
        query = "SELECT * FROM Courses WHERE faculty_id=%s"
        params = (user["id"],)
    # 3. Students shouldn't hit this route, but just in case:
    else: 
        return {"data": [], "total": 0}

    # Handle Search
    if q and q != "undefined":
        if params:
            query += " AND (LOWER(name) LIKE LOWER(%s) OR LOWER(code) LIKE LOWER(%s))"
        else:
            query += " WHERE LOWER(name) LIKE LOWER(%s) OR LOWER(code) LIKE LOWER(%s)"
        params += (f"%{q}%", f"%{q}%")
        
    count_query = query.replace("SELECT *", "SELECT COUNT(*) as total")
    total = execute_query(count_query, params, fetch_one=True)["total"]
    
    query += " LIMIT %s OFFSET %s"
    params += (limit, skip)
    rows = execute_query(query, params)
    
    return {"data": rows, "total": total}


@app.post("/api/courses")
def insert_course(req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    fid = req.get("faculty_id")
    if user["role"] == "faculty":
        fid = user["id"]
    try: fid = int(fid) if str(fid).strip() and str(fid).lower() != "null" else None
    except ValueError: fid = None

    execute_query("INSERT INTO Courses (faculty_id, code, name, credits, type) VALUES (%s, %s, %s, %s, %s)",
                  (fid, req.get("code","NNN000"), req.get("name","New Course"), int(req.get("credits",3)), req.get("type","Theory")),
                  commit=True)
    return {"status": "inserted"}

@app.put("/api/courses/{item_id}")
def update_course(item_id: int, req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    if user["role"] == "faculty":
        valid_cids = get_faculty_course_ids(user["id"])
        if item_id not in valid_cids:
            raise HTTPException(status_code=403, detail="You can only edit your own courses")
            
    fid = req.get("faculty_id")
    if user["role"] == "faculty":
        fid = user["id"]
    try: fid = int(fid) if str(fid).strip() and str(fid).lower() != "null" else None
    except ValueError: fid = None

    execute_query("UPDATE Courses SET faculty_id=%s, code=%s, name=%s, credits=%s, type=%s WHERE id=%s",
                 (fid, req.get("code"), req.get("name"), int(req.get("credits", 3)), req.get("type"), item_id), commit=True)
    return {"status": "updated"}

@app.delete("/api/courses/{item_id}")
def delete_course(item_id: int, user: dict = Depends(role_required(["admin", "faculty"]))):
    if user["role"] == "faculty":
        valid_cids = get_faculty_course_ids(user["id"])
        if item_id not in valid_cids:
            raise HTTPException(status_code=403, detail="You can only delete your own courses")

    execute_query("DELETE FROM Courses WHERE id=%s", (item_id,), commit=True)
    return {"status": "deleted"}

# ─── Quizzes CRUD (scoped) ───────────────────────────────
@app.get("/api/quizzes")
def get_all_quizzes(user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        quizzes = execute_query("SELECT q.*, c.name as course_name FROM Quizzes q LEFT JOIN Courses c ON q.course_id=c.id")
    else:
        cids = get_faculty_course_ids(user["id"])
        if not cids:
            return []
        ph = ",".join(["%s"] * len(cids))
        quizzes = execute_query(f"SELECT q.*, c.name as course_name FROM Quizzes q LEFT JOIN Courses c ON q.course_id=c.id WHERE q.course_id IN ({ph})", tuple(cids))
    for q in quizzes:
        if isinstance(q["questions_json"], str):
            q["questions_json"] = json.loads(q["questions_json"])
    return quizzes

@app.get("/api/quizzes/list")
def list_quizzes_table(skip: int = 0, limit: int = 10, q: str = "", user: dict = Depends(get_current_user)):
    if user["role"] == "admin":
        query = "SELECT q.id, q.title, q.course_id, c.name as course_name, q.weightage, q.max_marks FROM Quizzes q LEFT JOIN Courses c ON q.course_id=c.id"
        params = ()
    else:
        cids = get_faculty_course_ids(user["id"])
        if not cids:
            return {"data": [], "total": 0}
        ph = ",".join(["%s"] * len(cids))
        query = f"SELECT q.id, q.title, q.course_id, c.name as course_name, q.weightage, q.max_marks FROM Quizzes q LEFT JOIN Courses c ON q.course_id=c.id WHERE q.course_id IN ({ph})"
        params = tuple(cids)
    if q and q != "undefined":
        query += (" AND" if "WHERE" in query else " WHERE") + " LOWER(q.title) LIKE LOWER(%s)"
        params += (f"%{q}%",)
    count_query = query.replace("SELECT q.id, q.title, q.course_id, c.name as course_name, q.weightage, q.max_marks", "SELECT COUNT(*) as total")
    total = execute_query(count_query, params, fetch_one=True)["total"]
    query += " LIMIT %s OFFSET %s"
    params += (limit, skip)
    rows = execute_query(query, params)
    return {"data": rows, "total": total}

@app.post("/api/quizzes")
@app.post("/api/quizzes/list")
def insert_quiz(req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    questions = req.get("questions_json", "{}")
    if isinstance(questions, dict):
        questions = json.dumps(questions)
    
    try: cid = int(req.get("course_id")) if str(req.get("course_id", "")).strip() else 1
    except ValueError: cid = 1
    
    try: weight = float(req.get("weightage")) if str(req.get("weightage", "")).strip() else 100.0
    except ValueError: weight = 100.0
    
    try: max_m = float(req.get("max_marks")) if str(req.get("max_marks", "")).strip() else 100.0
    except ValueError: max_m = 100.0

    if user["role"] == "faculty":
        valid_cids = get_faculty_course_ids(user["id"])
        if cid not in valid_cids:
            raise HTTPException(status_code=403, detail="You can only add quizzes to your own courses")

    execute_query("INSERT INTO Quizzes (course_id, title, questions_json, weightage, max_marks) VALUES (%s,%s,%s,%s,%s)",
                  (cid, req.get("title","New Quiz"), questions, weight, max_m), commit=True)
    return {"status": "inserted"}

@app.put("/api/quizzes/{item_id}")
@app.put("/api/quizzes/list/{item_id}")
def update_quiz(item_id: int, req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    if user["role"] == "faculty":
        quiz = execute_query("SELECT course_id FROM Quizzes WHERE id=%s", (item_id,), fetch_one=True)
        if quiz:
            valid_cids = get_faculty_course_ids(user["id"])
            if quiz["course_id"] not in valid_cids:
                raise HTTPException(status_code=403, detail="You can only edit your own quizzes")
    
    cols = []
    params = []
    for k in ["title", "course_id", "questions_json", "weightage", "max_marks"]:
        if k in req:
            val = req[k]
            if k == "questions_json" and isinstance(val, (dict, list)): 
                val = json.dumps(val)
            elif k in ["weightage", "max_marks"]:
                try: val = float(val) if str(val).strip() else 100.0
                except ValueError: val = 100.0
            elif k == "course_id":
                try: val = int(val) if str(val).strip() else 1
                except ValueError: val = 1
                
            cols.append(f"{k}=%s")
            params.append(val)
            
    if not cols: return {"status": "no change"}
    params.append(item_id)
    execute_query(f"UPDATE Quizzes SET {', '.join(cols)} WHERE id=%s", tuple(params), commit=True)
    return {"status": "updated"}

@app.delete("/api/quizzes/{item_id}")
@app.delete("/api/quizzes/list/{item_id}")
def delete_quiz(item_id: int, user: dict = Depends(role_required(["admin", "faculty"]))):
    if user["role"] == "faculty":
        quiz = execute_query("SELECT course_id FROM Quizzes WHERE id=%s", (item_id,), fetch_one=True)
        if quiz:
            valid_cids = get_faculty_course_ids(user["id"])
            if quiz["course_id"] not in valid_cids:
                raise HTTPException(status_code=403, detail="You can only delete your own quizzes")
    execute_query("DELETE FROM Quizzes WHERE id=%s", (item_id,), commit=True)
    return {"status": "deleted"}

@app.get("/api/quizzes/{quiz_id}")
def get_quiz_detail(quiz_id: int, user: dict = Depends(get_current_user)):
    quiz = execute_query("SELECT * FROM Quizzes WHERE id=%s", (quiz_id,), fetch_one=True)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if isinstance(quiz["questions_json"], str):
        quiz["questions_json"] = json.loads(quiz["questions_json"])
    return quiz

# ─── Enrollments CRUD ────────────────────────────────────
@app.get("/api/enrollments")
def get_enrollments(skip: int = 0, limit: int = 10, q: str = "", user: dict = Depends(get_current_user)):
    base = """SELECT e.id, u.registration_number, c.code as course_code, u.name as student_name, c.name as course_name,
              e.total_classes, e.attended_classes, e.attendance_percentage, e.eligibility
              FROM Enrollments e JOIN Users u ON e.student_id=u.id JOIN Courses c ON e.course_id=c.id"""
    params = ()
    if user["role"] != "admin":
        cids = get_faculty_course_ids(user["id"])
        if not cids:
            return {"data": [], "total": 0}
        ph = ",".join(["%s"] * len(cids))
        base += f" WHERE e.course_id IN ({ph})"
        params = tuple(cids)
    if q and q != "undefined":
        base += (" AND" if "WHERE" in base else " WHERE") + " (LOWER(u.name) LIKE LOWER(%s) OR LOWER(u.registration_number) LIKE LOWER(%s) OR LOWER(c.name) LIKE LOWER(%s))"
        params += (f"%{q}%", f"%{q}%", f"%{q}%")
    count_q = base.replace("SELECT e.id, u.registration_number, c.code as course_code, u.name as student_name, c.name as course_name,\n              e.total_classes, e.attended_classes, e.attendance_percentage, e.eligibility", "SELECT COUNT(*) as total")
    total = execute_query(count_q, params, fetch_one=True)["total"]
    base += " LIMIT %s OFFSET %s"
    params += (limit, skip)
    rows = execute_query(base, params)
    return {"data": rows, "total": total}

@app.post("/api/enrollments")
def insert_enrollment(req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    try: student_id = int(req.get("student_id")) if str(req.get("student_id", "")).strip() else 0
    except (ValueError, TypeError): raise HTTPException(status_code=400, detail="Invalid student_id format")
    
    try: course_id = int(req.get("course_id")) if str(req.get("course_id", "")).strip() else 0
    except (ValueError, TypeError): raise HTTPException(status_code=400, detail="Invalid course_id format")
    
    if not student_id or not course_id:
        raise HTTPException(status_code=400, detail="student_id and course_id are strictly required")

    if user["role"] == "faculty":
        valid_cids = get_faculty_course_ids(user["id"])
        if course_id not in valid_cids:
            raise HTTPException(status_code=403, detail="Can only enroll students in your own courses")

    # Defaults for new enrollment: 0/40 attended, 0% = Debarred
    try: attended = int(req.get("attended_classes")) if str(req.get("attended_classes", "")).strip() else 0
    except (ValueError, TypeError): attended = 0
    
    try: total = int(req.get("total_classes")) if str(req.get("total_classes", "")).strip() else 40
    except (ValueError, TypeError): total = 40

    pct = (attended / total * 100) if total > 0 else 0
    elig = "Eligible" if pct >= 75 else "Debarred"

    try:
        execute_query(
            "INSERT INTO Enrollments (student_id, course_id, total_classes, attended_classes, attendance_percentage, eligibility) VALUES (%s,%s,%s,%s,%s,%s)",
            (student_id, course_id, total, attended, pct, elig), commit=True)
    except HTTPException as e:
        if "Duplicate" in str(e.detail) or "UNIQUE" in str(e.detail).upper():
             raise HTTPException(status_code=400, detail="Student is already enrolled in this course")
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database insertion failed: {str(e)}")
    
    return {"status": "inserted"}

@app.get("/api/courses/{course_id}/unenrolled_students")
def get_unenrolled_students(course_id: int, user: dict = Depends(role_required(["admin", "faculty"]))):
    if user["role"] == "faculty":
        valid_cids = get_faculty_course_ids(user["id"])
        if course_id not in valid_cids:
            return {"data": []}
            
    rows = execute_query("""
        SELECT id, name, registration_number 
        FROM Users 
        WHERE role='student' AND id NOT IN (
            SELECT student_id FROM Enrollments WHERE course_id=%s
        )
        ORDER BY name ASC
    """, (course_id,))
    return {"data": rows}

@app.put("/api/enrollments/{item_id}")
def update_enrollment(item_id: int, req: dict):
    attended = int(req.get("attended_classes", 0))
    total = int(req.get("total_classes", 40))
    pct = (attended / total * 100) if total > 0 else 0
    elig = "Eligible" if pct >= 75 else "Debarred"
    execute_query("UPDATE Enrollments SET attended_classes=%s, total_classes=%s, attendance_percentage=%s, eligibility=%s WHERE id=%s",
        (attended, total, pct, elig, item_id), commit=True)
    return {"status": "updated"}

@app.delete("/api/enrollments/{item_id}")
def delete_enrollment(item_id: int):
    execute_query("DELETE FROM Enrollments WHERE id=%s", (item_id,), commit=True)
    return {"status": "deleted"}

# ─── Materials + File Upload ─────────────────────────────
@app.get("/api/courses/{course_id}/materials")
def get_course_materials(course_id: int):
    materials = execute_query("SELECT id, title, file_url, uploaded_at FROM Materials WHERE course_id=%s", (course_id,))
    return {"data": materials}

@app.post("/api/courses/{course_id}/materials/upload")
async def upload_material(course_id: int, title: str = Form(...), file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    file_url = f"/uploads/{filename}"
    execute_query("INSERT INTO Materials (course_id, title, file_url) VALUES (%s,%s,%s)",
                  (course_id, title, file_url), commit=True)
    return {"status": "uploaded", "file_url": file_url}

@app.delete("/api/materials/{item_id}")
def delete_material(item_id: int):
    execute_query("DELETE FROM Materials WHERE id=%s", (item_id,), commit=True)
    return {"status": "deleted"}

# ─── Student My Courses ──────────────────────────────────
@app.get("/api/me/courses")
def get_my_courses(user: dict = Depends(get_current_user)):
    courses = execute_query("""
        SELECT c.id, c.code, c.name, c.credits, c.type, e.attendance_percentage, e.eligibility
        FROM Enrollments e JOIN Courses c ON e.course_id = c.id
        WHERE e.student_id = %s
    """, (user["id"],))
    return {"data": courses}

# ─── Assignments CRUD ────────────────────────────────────
@app.get("/api/courses/{course_id}/assignments")
def get_course_assignments(course_id: int, user: dict = Depends(get_current_user)):
    assignments = execute_query("""
        SELECT id, title, description, reference_file_url, due_date, created_at
        FROM Assignments WHERE course_id=%s ORDER BY due_date
    """, (course_id,))
    # For students, also fetch their submission status
    if user["role"] == "student":
        for a in assignments:
            sub = execute_query("""
                SELECT id, file_url, submitted_at, status, grade
                FROM Assignment_Submissions WHERE assignment_id=%s AND student_id=%s
            """, (a["id"], user["id"]), fetch_one=True)
            a["submission"] = sub
    return {"data": assignments}

@app.post("/api/courses/{course_id}/assignments")
def create_assignment(course_id: int, req: dict):
    execute_query(
        "INSERT INTO Assignments (course_id, title, description, reference_file_url, due_date) VALUES (%s,%s,%s,%s,%s)",
        (course_id, req.get("title",""), req.get("description",""), req.get("reference_file_url"), req.get("due_date")),
        commit=True)
    return {"status": "created"}

@app.delete("/api/assignments/{item_id}")
def delete_assignment(item_id: int):
    execute_query("DELETE FROM Assignments WHERE id=%s", (item_id,), commit=True)
    return {"status": "deleted"}

# ─── Faculty: View all submissions for a course ──────────
@app.get("/api/courses/{course_id}/assignments/submissions")
def get_course_submissions(course_id: int, user: dict = Depends(role_required(["admin", "faculty"]))):
    submissions = execute_query("""
        SELECT s.id, s.assignment_id, a.title as assignment_title,
               u.name as student_name, u.registration_number,
               s.file_url, s.submitted_at, s.status, s.grade
        FROM Assignment_Submissions s
        JOIN Assignments a ON s.assignment_id = a.id
        JOIN Users u ON s.student_id = u.id
        WHERE a.course_id = %s
        ORDER BY s.submitted_at DESC
    """, (course_id,))
    return {"data": submissions}

# ─── Faculty: Grade a submission ─────────────────────────
@app.put("/api/submissions/{submission_id}/grade")
def grade_submission(submission_id: int, req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    execute_query(
        "UPDATE Assignment_Submissions SET grade=%s, status='graded' WHERE id=%s",
        (float(req.get("grade", 0)), submission_id), commit=True
    )
    return {"status": "graded"}

@app.post("/api/assignments/{assignment_id}/submit")
async def submit_assignment(assignment_id: int, file: UploadFile = File(...), user: dict = Depends(role_required(["student"]))):
    # Check due date
    assignment = execute_query("SELECT due_date FROM Assignments WHERE id=%s", (assignment_id,), fetch_one=True)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    ext = os.path.splitext(file.filename)[1]
    filename = f"sub_{user['id']}_{assignment_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    file_url = f"/uploads/{filename}"
    now = datetime.now()
    status = "late" if assignment["due_date"] and now > assignment["due_date"] else "submitted"
    execute_query("""
        INSERT INTO Assignment_Submissions (assignment_id, student_id, file_url, status)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE file_url=%s, status=%s, submitted_at=NOW()
    """, (assignment_id, user["id"], file_url, status, file_url, status), commit=True)
    return {"status": status, "file_url": file_url}

# ─── Quiz Builder (create MCQ) ───────────────────────────
@app.post("/api/quizzes/create")
def create_quiz_with_questions(req: dict, user: dict = Depends(role_required(["admin", "faculty"]))):
    """Create a quiz with MCQ questions from the builder UI"""
    course_id = int(req.get("course_id", 1))
    title = req.get("title", "New Quiz")
    weightage = float(req.get("weightage", 100))
    max_marks = float(req.get("max_marks", 100))
    questions = req.get("questions", [])
    # Build JSON: {"q1": {"text":..., "options":[...], "answer":...}, ...}
    q_json = {}
    for i, q in enumerate(questions):
        q_json[f"q{i+1}"] = {
            "text": q.get("text", ""),
            "options": q.get("options", []),
            "answer": q.get("answer", "")
        }
    execute_query(
        "INSERT INTO Quizzes (course_id, title, questions_json, weightage, max_marks) VALUES (%s,%s,%s,%s,%s)",
        (course_id, title, json.dumps(q_json), weightage, max_marks), commit=True)
    return {"status": "created"}
