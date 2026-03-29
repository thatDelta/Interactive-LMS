# backend/seed.py
import os
import json
import mysql.connector

# Hardcoded for the script.
# Database configuration from environment variables
DB_HOST = os.getenv("TIDB_HOST")
DB_USER = os.getenv("TIDB_USER")
DB_PASS = os.getenv("TIDB_PASS")
DB_NAME = os.getenv("TIDB_DB", "test")
DB_PORT = int(os.getenv("TIDB_PORT", 4000))

def get_db_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASS,
        database=DB_NAME,
        port=DB_PORT,
        ssl_disabled=False
    )

def run_seed():
    print("Connecting to TiDB...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Drop tables in proper order
    tables_to_drop = [
        "Assignment_Submissions", "Assignments",
        "Quiz_Scores", "Quizzes", "Materials", "Enrollments", 
        "Courses", "Students", "Users"
    ]
    for table in tables_to_drop:
        try:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
            print(f"Dropped {table}")
        except Exception as e:
            print(f"Error dropping {table}: {e}")

    # Schema Re-creation
    schema = [
        """
        CREATE TABLE Users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            registration_number VARCHAR(15) UNIQUE,
            email VARCHAR(100) UNIQUE,
            name VARCHAR(100),
            password_hash VARCHAR(255),
            birth_year INT,
            role ENUM('admin', 'faculty', 'student') NOT NULL
        )
        """,
        """
        CREATE TABLE Courses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(20) UNIQUE NOT NULL,
            name VARCHAR(150),
            faculty_id INT,
            credits INT NOT NULL,
            type ENUM('Theory', 'Lab') NOT NULL,
            FOREIGN KEY (faculty_id) REFERENCES Users(id) ON DELETE SET NULL
        )
        """,
        """
        CREATE TABLE Enrollments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT,
            course_id INT,
            total_classes INT DEFAULT 0,
            attended_classes INT DEFAULT 0,
            attendance_percentage DECIMAL(5,2) DEFAULT 0,
            eligibility ENUM('Eligible', 'Debarred') DEFAULT 'Debarred',
            enrollment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES Users(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE,
            UNIQUE KEY (student_id, course_id)
        )
        """,
        """
        CREATE TABLE Materials (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_id INT,
            title VARCHAR(150),
            file_url VARCHAR(255),
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE Quizzes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_id INT,
            title VARCHAR(150),
            questions_json JSON,
            weightage DECIMAL(5,2),
            max_marks DECIMAL(5,2),
            FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE Quiz_Scores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            quiz_id INT,
            student_id INT,
            marks_obtained DECIMAL(5,2),
            FOREIGN KEY (quiz_id) REFERENCES Quizzes(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES Users(id) ON DELETE CASCADE,
            UNIQUE KEY (quiz_id, student_id)
        )
        """,
        """
        CREATE TABLE Assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            course_id INT,
            title VARCHAR(200),
            description TEXT,
            reference_file_url VARCHAR(255),
            due_date DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES Courses(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE Assignment_Submissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            assignment_id INT,
            student_id INT,
            file_url VARCHAR(255),
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status ENUM('submitted', 'late', 'graded') DEFAULT 'submitted',
            grade DECIMAL(5,2),
            FOREIGN KEY (assignment_id) REFERENCES Assignments(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES Users(id) ON DELETE CASCADE,
            UNIQUE KEY (assignment_id, student_id)
        )
        """
    ]
    
    for stmt in schema:
        print(f"Executing: {stmt.strip().split('(')[0]}")
        cursor.execute(stmt)
    
    # Committing schema
    conn.commit()
    print("Schema created successfully!")
    
    users = [
        ("ADM001", "admin@eduflow.edu", "System Admin", "password123", 2000, "admin"),
        ("FAC001", "faculty1@eduflow.edu", "Dr. Rajesh M", "password123", 1980, "faculty"),
        ("FAC002", "faculty2@eduflow.edu", "Prof. Jane Doe", "password123", 1985, "faculty"),
        ("STU001", "student1@eduflow.edu", "Student Alpha", "password123", 2005, "student"),
        ("STU002", "student2@eduflow.edu", "Student Beta", "password123", 2005, "student"),
        ("STU003", "student3@eduflow.edu", "Student Gamma", "password123", 2005, "student"),
        ("STU004", "student4@eduflow.edu", "Student Delta", "password123", 2005, "student"),
        ("STU005", "student5@eduflow.edu", "Student Epsilon", "password123", 2005, "student"),
        ("STU006", "student6@eduflow.edu", "Student Zeta", "password123", 2005, "student"),
        ("STU007", "student7@eduflow.edu", "Student Eta", "password123", 2005, "student")
    ]
    
    cursor.executemany(
        "INSERT INTO Users (registration_number, email, name, password_hash, birth_year, role) VALUES (%s, %s, %s, %s, %s, %s)", 
        users
    )
    conn.commit()
    print("Seeded 10 Users!")
    
    # 8 Courses, mapping 5 explicitly to Rajesh (ID=2)
    courses = [
        ("BCSE302L", "Database Systems Theory", 2, 3, "Theory"),
        ("BCSE302P", "Database Systems Lab", 2, 1, "Lab"),
        ("BCSE308L", "Computer Networks Theory", 2, 3, "Theory"),
        ("BCSE308P", "Computer Networks Lab", 2, 1, "Lab"),
        ("BMAT102L", "Differential Equations and Transforms", 2, 4, "Theory"),
        ("BMAT205L", "Discrete Math and Graph Theory", 3, 4, "Theory"),
        ("BCSE301L", "Artificial Intelligence", 3, 3, "Theory"),
        ("BMAT301L", "Complex Variables and Linear Algebra", 3, 4, "Theory")
    ]
    cursor.executemany(
        "INSERT INTO Courses (code, name, faculty_id, credits, type) VALUES (%s, %s, %s, %s, %s)",
        courses
    )
    conn.commit()
    print("Seeded Courses!")

    enrollment_data = []
    # 7 Students (IDs 4 to 10), assign all to DB Theory (1), DB Lab (2), etc
    for s_id in range(4, 11):
        for c_id in range(1, 4):
            attended = 36 if s_id % 2 == 0 else 20
            percent = (attended / 40.0) * 100.0
            elig = "Eligible" if percent >= 75.0 else "Debarred"
            enrollment_data.append((s_id, c_id, 40, attended, percent, elig))
            
    # Also enroll Admin Dhananjay(1) in DB Theory(1) to test the admin overlap logic
    enrollment_data.append((1, 1, 40, 40, 100.0, "Eligible"))

    cursor.executemany(
        "INSERT INTO Enrollments (student_id, course_id, total_classes, attended_classes, attendance_percentage, eligibility) VALUES (%s, %s, %s, %s, %s, %s)",
        enrollment_data
    )
    conn.commit()
    print("Seeded Enrollments!")
    
    # Materials Seeding
    materials = [
        (1, "Normalization Rules PDF", "/uploads/normalization.pdf"),
        (1, "SQL Joins Cheatsheet", "/uploads/sql_joins.pdf"),
        (1, "1NF to 3NF Slide Deck", "/uploads/normal_forms_slides.ppt"),
        (2, "MySQL Installation Guide", "/uploads/mysql_install.txt"),
        (2, "Lab Assesment 1 Specs", "/uploads/lab1.pdf"),
        (3, "OSI Model Diagram", "/uploads/osi.png"),
        (3, "TCP vs UDP Summary", "/uploads/tcp_udp.pdf"),
        (5, "Differential Equations Intro", "/uploads/diff_calc.pdf"),
        (7, "A* Search Algorithm", "/uploads/a_star.pdf"),
        (8, "Linear Algebra Worksheets", "/uploads/algebra_ws.pdf")
    ]
    cursor.executemany(
        "INSERT INTO Materials (course_id, title, file_url) VALUES (%s, %s, %s)",
        materials
    )
    conn.commit()
    print("Seeded 10 Materials!")

    # Quizzes Seeding (Reformatted for Front-End MCQs!)
    q_json_1 = json.dumps({
        "q1": {"text": "What does SQL stand for?", "options": ["Structured Query Language", "Simple Question Language", "System Query Link"], "answer": "Structured Query Language"},
        "q2": {"text": "What normal form removes partial dependencies?", "options": ["1NF", "2NF", "3NF", "BCNF"], "answer": "2NF"}
    })
    q_json_2 = json.dumps({
        "q1": {"text": "Which clause filters aggregate results?", "options": ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], "answer": "HAVING"}
    })
    quizzes = [
        (1, "Database Fundamentals MCQ", q_json_1, 50.0, 100.0),
        (1, "Normalization Test", q_json_2, 50.0, 50.0),
        (2, "Lab Exam Practice", q_json_2, 100.0, 100.0),
        (3, "Networking Basic Layers", q_json_1, 100.0, 100.0),
        (5, "Derivatives Check", q_json_1, 100.0, 50.0),
        (6, "Discrete Trees", q_json_2, 100.0, 100.0),
        (7, "AI Search Techniques", q_json_1, 100.0, 50.0)
    ]
    cursor.executemany(
        "INSERT INTO Quizzes (course_id, title, questions_json, weightage, max_marks) VALUES (%s, %s, %s, %s, %s)",
        quizzes
    )
    conn.commit()
    print("Seeded Quizzes!")
    
    # Quiz Scores mapping varying outputs:
    # Tejas (4) -> gets 100 on everything -> 95%+ -> S grade -> 10 GP -> ~10 CGPA
    # Neil (5) -> gets moderate marks -> 85% -> B -> ~8 CGPA
    # Nikhil (6) -> gets poor marks -> 65% -> D -> ~6 CGPA
    # Abhishek (7) -> gets fail marks -> 40% -> F -> 0 CGPA
    # Dhananjay (1) -> Admin test overlapping
    scores = [
        # Dhananjay
        (1, 1, 95.0), (2, 1, 48.0), # S and A
        # Tejas
        (1, 4, 100.0), (2, 4, 50.0), (3, 4, 100.0), (4, 4, 100.0), 
        # Neil (Around B/A Grade)
        (1, 5, 85.0),  (2, 5, 42.0), (3, 5, 80.0), (4, 5, 80.0),
        # Nikhil (Around 6/7 CGPA)
        (1, 6, 65.0),  (2, 6, 32.0), (3, 6, 62.0), (4, 6, 70.0),
        # Abhishek (Fails everything, 0 CGPA)
        (1, 7, 30.0),  (2, 7, 10.0), (3, 7, 40.0), (4, 7, 30.0)
    ]
    cursor.executemany(
        "INSERT INTO Quiz_Scores (quiz_id, student_id, marks_obtained) VALUES (%s, %s, %s)",
        scores
    )
    conn.commit()
    print("Seeded Quiz_Scores!")
    
    # Assignments seeding - mix of past due and future due dates
    assignments = [
        (1, "ER Diagram Design", "Design an ER diagram for a university database with at least 5 entities.", "/uploads/er_template.pdf", "2026-03-20 23:59:00"),
        (1, "SQL Query Practice", "Write 10 SQL queries covering JOIN, GROUP BY, and subqueries.", None, "2026-04-15 23:59:00"),
        (2, "Lab Report 1", "Submit your MySQL installation screenshots and first 5 queries.", None, "2026-03-25 23:59:00"),
        (3, "OSI Model Essay", "Write a 500-word essay on the OSI model layers.", "/uploads/osi_reference.pdf", "2026-04-10 23:59:00"),
        (1, "Normalization Exercise", "Normalize the given table from UNF to 3NF. Show all steps.", None, "2026-04-20 23:59:00"),
    ]
    cursor.executemany(
        "INSERT INTO Assignments (course_id, title, description, reference_file_url, due_date) VALUES (%s, %s, %s, %s, %s)",
        assignments
    )
    conn.commit()
    print("Seeded Assignments!")

    # A few submissions
    submissions = [
        (1, 4, "/uploads/tejas_er.pdf", "2026-03-19 20:00:00", "graded", 85.0),
        (1, 5, "/uploads/neil_er.pdf", "2026-03-21 02:00:00", "late", None),
        (3, 4, "/uploads/tejas_lab1.pdf", "2026-03-24 18:00:00", "submitted", None),
    ]
    cursor.executemany(
        "INSERT INTO Assignment_Submissions (assignment_id, student_id, file_url, submitted_at, status, grade) VALUES (%s, %s, %s, %s, %s, %s)",
        submissions
    )
    conn.commit()
    print("Seeded Assignment_Submissions!")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    run_seed()
