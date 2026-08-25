
INSERT INTO department (dept_name, location) VALUES
('Cardiology',      'Block A, 3rd Floor'),
('Neurology',       'Block A, 4th Floor'),
('Orthopedics',     'Block B, 2nd Floor'),
('Pediatrics',      'Block C, 1st Floor'),
('Gynecology',      'Block C, 2nd Floor'),
('General Medicine','Block A, 1st Floor'),
('Dermatology',     'Block B, 3rd Floor');

INSERT INTO doctor (name, specialization, phone, consult_fee, dept_id) VALUES
('Dr. Rezaul Karim',      'Interventional Cardiology', '01711000001', 1200.00, 1),
('Dr. Nasrin Sultana',    'Echocardiography',          '01711000002', 1000.00, 1),
('Dr. Aminul Haque',      'Stroke & Epilepsy',         '01711000003', 1500.00, 2),
('Dr. Farhana Yasmin',    'Joint Replacement',         '01711000004',  900.00, 3),
('Dr. Tanvir Ahmed',      'Spine Surgery',             '01711000005', 1300.00, 3),
('Dr. Shirin Akter',      'Neonatology',               '01711000006',  700.00, 4),
('Dr. Mahbubur Rahman',   'Child Nutrition',           '01711000007',  650.00, 4),
('Dr. Rokeya Begum',      'Obstetrics',                '01711000008', 1100.00, 5),
('Dr. Kamrul Hasan',      'Diabetes & Hypertension',   '01711000009',  800.00, 6),
('Dr. Sabrina Chowdhury', 'Cosmetic Dermatology',      '01711000010',  950.00, 7);

INSERT INTO patient (name, dob, gender, phone, address, blood_group) VALUES
('Rahim Uddin',      '1985-03-12','M','01811000001','Mirpur-10, Dhaka',        'B+'),
('Fatema Khatun',    '1992-07-25','F','01811000002','Dhanmondi-27, Dhaka',     'O+'),
('Sabbir Hossain',   '1978-11-02','M','01811000003','Uttara Sector-7, Dhaka',  'A+'),
('Nusrat Jahan',     '2001-01-18','F','01811000004','Bashundhara R/A, Dhaka',  'AB+'),
('Imran Kabir',      '1965-09-30','M','01811000005','Mohammadpur, Dhaka',      'O-'),
('Sharmin Akter',    '1996-05-14','F','01811000006','Gulshan-2, Dhaka',        'B-'),
('Jamal Mia',        '1950-12-08','M','01811000007','Old Dhaka, Dhaka',        'A-'),
('Taslima Begum',    '1988-02-21','F','01811000008','Banani, Dhaka',           'O+'),
('Arif Chowdhury',   '2015-06-11','M','01811000009','Baridhara, Dhaka',        'B+'),
('Rehana Parvin',    '1973-08-19','F','01811000010','Khilgaon, Dhaka',         'AB-'),
('Sohel Rana',       '1999-04-05','M','01811000011','Mugda, Dhaka',            'A+'),
('Mim Akter',        '2018-10-27','F','01811000012','Rampura, Dhaka',          'O+');

INSERT INTO room (room_no, room_type, daily_charge, status) VALUES
('A-101','General',      1500.00,'Available'),
('A-102','General',      1500.00,'Available'),
('A-103','General',      1500.00,'Available'),
('B-201','Semi-Private', 3000.00,'Available'),
('B-202','Semi-Private', 3000.00,'Available'),
('C-301','Private',      5500.00,'Available'),
('C-302','Private',      5500.00,'Available'),
('I-401','ICU',         12000.00,'Available'),
('I-402','ICU',         12000.00,'Available'),
('K-501','CCU',         15000.00,'Maintenance');

INSERT INTO medicine (name, unit_price, stock_qty) VALUES
('Napa 500mg',          1.50, 5000),
('Seclo 20mg',          6.00, 3200),
('Monas 10mg',         16.00, 1800),
('Amlodipine 5mg',      4.50, 2500),
('Metformin 500mg',     3.00, 4000),
('Cef-3 200mg',        35.00,  900),
('Fexo 120mg',          9.00, 1500),
('Losartan 50mg',       7.50, 2200),
('Atorvastatin 20mg',  12.00, 1700),
('Calbo-D',             8.00, 2600),
('Insulin 30/70',     420.00,  300),
('Omeprazole 40mg',     9.50, 1100);

INSERT INTO lab_test (test_name, cost) VALUES
('Complete Blood Count (CBC)',   500.00),
('Fasting Blood Sugar',          300.00),
('Lipid Profile',               1500.00),
('Serum Creatinine',             600.00),
('ECG',                          800.00),
('Chest X-Ray',                 1000.00),
('Echocardiogram',              3500.00),
('MRI Brain',                   9000.00),
('Urine R/E',                    400.00),
('Thyroid Function Test (TSH)', 1200.00);

INSERT INTO doctor_schedule
 (doctor_id, day_of_week, start_time, end_time, chamber_no, slot_duration, max_patients, is_active) VALUES
(1,'Saturday' ,'17:00','21:00','A-301',20,12,TRUE),
(1,'Monday'   ,'17:00','21:00','A-301',20,12,TRUE),
(1,'Wednesday','17:00','20:00','A-301',20, 9,TRUE),
(2,'Sunday'   ,'16:00','20:00','A-302',15,16,TRUE),
(2,'Tuesday'  ,'16:00','20:00','A-302',15,16,TRUE),
(3,'Saturday' ,'18:00','22:00','A-401',30, 8,TRUE),
(3,'Thursday' ,'18:00','22:00','A-401',30, 8,TRUE),
(4,'Sunday'   ,'15:00','19:00','B-201',20,12,TRUE),
(5,'Monday'   ,'18:00','21:00','B-202',20, 9,TRUE),
(6,'Saturday' ,'09:00','13:00','C-101',15,16,TRUE),
(6,'Sunday'   ,'09:00','13:00','C-101',15,16,TRUE),
(7,'Tuesday'  ,'10:00','14:00','C-102',15,16,TRUE),
(8,'Wednesday','16:00','20:00','C-201',20,12,TRUE),
(9,'Saturday' ,'10:00','14:00','A-102',15,16,TRUE),
(9,'Monday'   ,'10:00','14:00','A-102',15,16,TRUE),
(10,'Thursday','17:00','20:00','B-301',20, 9,FALSE);

INSERT INTO appointment (patient_id, doctor_id, schedule_id, appt_date, time_slot, status) VALUES
( 1, 1, 1,'2026-07-04','17:20','Completed'),
( 2, 9,14,'2026-07-04','10:15','Completed'),
( 3, 1, 2,'2026-07-06','17:40','Completed'),
( 4, 8,13,'2026-07-08','16:20','Completed'),
( 5, 3, 6,'2026-07-11','18:30','Completed'),
( 6,10,16,'2026-07-09','17:20','Cancelled'),
( 7, 9,15,'2026-07-13','10:30','Completed'),
( 8, 4, 8,'2026-07-12','15:40','Completed'),
( 9, 6,10,'2026-07-11','09:30','Completed'),
(10, 2, 4,'2026-07-12','16:45','No-Show'),
(11, 5, 9,'2026-07-13','18:20','Completed'),
(12, 7,12,'2026-07-14','10:45','Completed'),
( 1, 2, 5,'2026-08-04','16:15','Scheduled'),
( 5, 1, 3,'2026-08-05','17:20','Scheduled'),
( 7, 3, 7,'2026-08-06','18:00','Scheduled');

INSERT INTO prescription (appt_id, presc_date, diagnosis) VALUES
( 1,'2026-07-04','Hypertension with mild LV hypertrophy'),
( 2,'2026-07-04','Type-2 Diabetes Mellitus, uncontrolled'),
( 3,'2026-07-06','Stable angina pectoris'),
( 4,'2026-07-08','First trimester pregnancy, routine checkup'),
( 5,'2026-07-11','Migraine without aura'),
( 7,'2026-07-13','Hyperlipidemia with early CKD'),
( 8,'2026-07-12','Osteoarthritis, both knees'),
( 9,'2026-07-11','Acute upper respiratory tract infection'),
(11,'2026-07-13','Lumbar disc prolapse L4-L5'),
(12,'2026-07-14','Iron deficiency anemia');

INSERT INTO presc_medicine (presc_id, med_id, dosage, frequency, duration) VALUES
( 1, 4,'5mg'  ,'1+0+0','30 days'),
( 1, 8,'50mg' ,'0+0+1','30 days'),
( 1, 2,'20mg' ,'1+0+0','14 days'),
( 2, 5,'500mg','1+0+1','60 days'),
( 2,11,'12 units','1+0+1','30 days'),
( 3, 9,'20mg' ,'0+0+1','90 days'),
( 3, 1,'500mg','1+1+1','5 days'),
( 4,10,'1 tab','1+0+0','90 days'),
( 5, 1,'500mg','1+1+1','7 days'),
( 5, 3,'10mg' ,'0+0+1','30 days'),
( 6, 9,'20mg' ,'0+0+1','90 days'),
( 6, 8,'50mg' ,'1+0+0','90 days'),
( 7, 1,'500mg','1+0+1','15 days'),
( 7,10,'1 tab','1+0+1','60 days'),
( 8, 6,'200mg','1+0+1','7 days'),
( 8, 7,'120mg','0+0+1','10 days'),
( 9, 1,'500mg','1+1+1','10 days'),
( 9,12,'40mg' ,'1+0+0','21 days'),
(10, 1,'500mg','1+0+1','7 days');

INSERT INTO patient_test (patient_id, test_id, test_date, result, doctor_id) VALUES
( 1, 5,'2026-07-04','Sinus rhythm, LVH pattern',              1),
( 1, 3,'2026-07-04','Total cholesterol 245 mg/dL — elevated', 1),
( 2, 2,'2026-07-04','Fasting glucose 11.2 mmol/L — high',     9),
( 2, 1,'2026-07-04','Hb 11.8 g/dL, WBC normal',               9),
( 3, 7,'2026-07-06','Ejection fraction 52%, mild MR',         1),
( 3, 5,'2026-07-06','ST depression in lead V4-V6',            1),
( 5, 8,'2026-07-11','No focal lesion detected',               3),
( 7, 4,'2026-07-13','Creatinine 1.6 mg/dL — mildly raised',   9),
( 7, 3,'2026-07-13','LDL 178 mg/dL — high',                   9),
( 8, 6,'2026-07-12','Degenerative changes, no fracture',      4),
( 9, 1,'2026-07-11','WBC 13,400 — leukocytosis',              6),
(11, 6,'2026-07-13','Reduced L4-L5 disc space',               5),
(12, 1,'2026-07-14','Hb 8.9 g/dL — anemia',                   7),
(12,10,'2026-07-14','TSH 3.1 mIU/L — normal',                 7),
( 1, 5,'2026-08-01','Sinus rhythm, improved',                 1);

INSERT INTO admission (patient_id, room_no, admit_date, discharge_date) VALUES
( 3,'C-301','2026-07-06','2026-07-10'),
( 5,'A-101','2026-07-11','2026-07-15'),
( 8,'B-201','2026-07-12','2026-07-16'),
(11,'B-202','2026-07-13','2026-07-18'),
( 9,'A-102','2026-07-11','2026-07-13'),
( 7,'I-401','2026-07-20','2026-07-27'),
( 1,'C-302','2026-08-01', NULL),
(12,'A-103','2026-08-02', NULL);

UPDATE room SET status='Occupied' WHERE room_no IN ('C-302','A-103');

INSERT INTO bill (patient_id, admission_id, issue_date, total_amount, pay_status) VALUES
( 3, 1,'2026-07-10',  0,'Unpaid'),
( 5, 2,'2026-07-15',  0,'Unpaid'),
( 8, 3,'2026-07-16',  0,'Unpaid'),
(11, 4,'2026-07-18',  0,'Unpaid'),
( 9, 5,'2026-07-13',  0,'Unpaid'),
( 7, 6,'2026-07-27',  0,'Unpaid'),
( 2, NULL,'2026-07-04', 0,'Unpaid'),   
(12, NULL,'2026-07-14', 0,'Unpaid');   

INSERT INTO bill_item (bill_id, item_no, description, amount) VALUES
(1,1,'Room charge — Private x 4 days', 22000.00),
(1,2,'Doctor visit — Dr. Rezaul Karim', 1200.00),
(1,3,'Echocardiogram',                  3500.00),
(1,4,'ECG',                              800.00),

(2,1,'Room charge — General x 4 days',  6000.00),
(2,2,'Doctor visit — Dr. Aminul Haque', 1500.00),
(2,3,'MRI Brain',                       9000.00),

(3,1,'Room charge — Semi-Private x 4 days', 12000.00),
(3,2,'Doctor visit — Dr. Farhana Yasmin',     900.00),
(3,3,'Chest X-Ray',                          1000.00),

(4,1,'Room charge — Semi-Private x 5 days', 15000.00),
(4,2,'Doctor visit — Dr. Tanvir Ahmed',      1300.00),
(4,3,'Chest X-Ray',                          1000.00),

(5,1,'Room charge — General x 2 days',  3000.00),
(5,2,'Doctor visit — Dr. Shirin Akter',  700.00),
(5,3,'Complete Blood Count (CBC)',       500.00),

(6,1,'Room charge — ICU x 7 days',     84000.00),
(6,2,'Doctor visit — Dr. Kamrul Hasan',  800.00),
(6,3,'Serum Creatinine',                 600.00),
(6,4,'Lipid Profile',                   1500.00),

(7,1,'Doctor visit — Dr. Kamrul Hasan',  800.00),
(7,2,'Fasting Blood Sugar',              300.00),
(7,3,'Complete Blood Count (CBC)',       500.00),

(8,1,'Doctor visit — Dr. Mahbubur Rahman', 650.00),
(8,2,'Complete Blood Count (CBC)',         500.00),
(8,3,'Thyroid Function Test (TSH)',       1200.00);

UPDATE bill b
SET total_amount = COALESCE(
    (SELECT SUM(bi.amount) FROM bill_item bi WHERE bi.bill_id = b.bill_id), 0);

INSERT INTO payment (bill_id, pay_date, method, paid_amount) VALUES
(1,'2026-07-10','Card',  27500.00),  
(2,'2026-07-15','bKash', 10000.00),   
(2,'2026-07-20','Cash',   6500.00),   
(3,'2026-07-16','Bank',  13900.00),  
(4,'2026-07-18','Nagad',  8000.00),   
(5,'2026-07-13','Cash',   4200.00),   
(6,'2026-07-27','Card',  50000.00),   
(7,'2026-07-04','bKash',  1600.00);   

UPDATE bill b
SET pay_status = CASE
    WHEN COALESCE((SELECT SUM(p.paid_amount) FROM payment p
                   WHERE p.bill_id = b.bill_id), 0) = 0            THEN 'Unpaid'
    WHEN COALESCE((SELECT SUM(p.paid_amount) FROM payment p
                   WHERE p.bill_id = b.bill_id), 0) >= b.total_amount THEN 'Paid'
    ELSE 'Partial'
END;
