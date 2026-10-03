-- Doctor 1-er appointment gula patient ar doctor name-shoho 
SELECT d.name AS doctor_name, p.name AS patient_name,
       a.appt_date, a.status
FROM appointment a
JOIN doctor d ON a.doctor_id = d.doctor_id
JOIN patient p ON a.patient_id = p.patient_id
WHERE d.doctor_id = 1
ORDER BY a.appt_date;

-- Prottek department-e koyjon doctor ache 
SELECT dep.dept_name, COUNT(d.doctor_id) AS total_doctors
FROM department dep
LEFT JOIN doctor d ON dep.dept_id = d.dept_id
GROUP BY dep.dept_name
ORDER BY total_doctors DESC;

-- Kar bill total koto, highest theke list kora hoise
SELECT p.name AS patient_name,
       SUM(b.total_amount) AS total_billed
FROM patient p
JOIN bill b ON p.patient_id = b.patient_id
GROUP BY p.name
ORDER BY total_billed DESC;

-- Available room-gula daily charge kom theke
SELECT room_no, room_type, daily_charge
FROM room
WHERE status = 'Available'
ORDER BY daily_charge;

-- Stock-e 1500-er kom medicine-gula check 
SELECT name, unit_price, stock_qty
FROM medicine
WHERE stock_qty < 1500
ORDER BY stock_qty ASC;

-- Kon month-e koyta appointment hoise, full count 
SELECT TO_CHAR(appt_date, 'YYYY-MM') AS month,
       COUNT(*) AS total_appointments
FROM appointment
GROUP BY TO_CHAR(appt_date, 'YYYY-MM')
ORDER BY month;

-- Department-wise average consultation fee 
SELECT dep.dept_name,
       ROUND(AVG(d.consult_fee), 2) AS avg_fee
FROM doctor d
JOIN department dep ON d.dept_id = dep.dept_id
GROUP BY dep.dept_name
ORDER BY avg_fee DESC;

-- Unpaid ba partial bill ache emon patient-gula, boro bill age 
SELECT p.name AS patient_name, p.phone,
       b.bill_id, b.total_amount, b.pay_status
FROM patient p
JOIN bill b ON p.patient_id = b.patient_id
WHERE b.pay_status IN ('Unpaid', 'Partial')
ORDER BY b.total_amount DESC;

-- Top 5 most prescribed medicine-er list
SELECT m.name, COUNT(pm.presc_id) AS times_prescribed
FROM medicine m
JOIN presc_medicine pm ON m.med_id = pm.med_id
GROUP BY m.name
ORDER BY times_prescribed DESC
LIMIT 5;

-- Prottek patient-er latest visit 
SELECT p.name AS patient_name, MAX(a.appt_date) AS last_visit
FROM patient p
JOIN appointment a ON p.patient_id = a.patient_id
GROUP BY p.name
ORDER BY last_visit DESC;

-- Doctor-der inactive schedule ar time slot-gula 
SELECT d.name AS doctor_name, ds.day_of_week, ds.start_time, ds.end_time
FROM doctor_schedule ds
JOIN doctor d ON ds.doctor_id = d.doctor_id
WHERE ds.is_active = FALSE;

-- Doctor-wise completed appointment koyta ar estimated income koto
SELECT d.name AS doctor_name,
       COUNT(a.appt_id) AS completed_appointments,
       COUNT(a.appt_id) * d.consult_fee AS total_income
FROM doctor d
JOIN appointment a ON d.doctor_id = a.doctor_id
WHERE a.status = 'Completed'
GROUP BY d.name, d.consult_fee
ORDER BY total_income DESC;

-- Total bill onujayi patient ranking, highest bill-er jonno rank 1
SELECT p.name AS patient_name,
       SUM(b.total_amount) AS total_billed,
       RANK() OVER (ORDER BY SUM(b.total_amount) DESC) AS bill_rank
FROM patient p
JOIN bill b ON p.patient_id = b.patient_id
GROUP BY p.name;

-- Je department-e ekadhik doctor ache, shegulai ekhane.
SELECT dep.dept_name, COUNT(d.doctor_id) AS doctor_count
FROM department dep
JOIN doctor d ON dep.dept_id = d.dept_id
GROUP BY dep.dept_name
HAVING COUNT(d.doctor_id) > 1
ORDER BY doctor_count DESC;

-- Appointment ache but konotai cancelled na, emon patient
SELECT p.name AS patient_name
FROM patient p
WHERE NOT EXISTS (
    SELECT 1 FROM appointment a
    WHERE a.patient_id = p.patient_id AND a.status = 'Cancelled'
)
AND EXISTS (
    SELECT 1 FROM appointment a WHERE a.patient_id = p.patient_id
);

-- Jader appointment-er sathe kono prescription nai oi doctor-gula 
SELECT d.name AS doctor_name
FROM doctor d
WHERE NOT EXISTS (
    SELECT 1
    FROM appointment a
    JOIN prescription pr ON a.appt_id = pr.appt_id
    WHERE a.doctor_id = d.doctor_id
);

-- Bill amount dekhe Small, Medium, na Large category set kora hoise
SELECT bill_id, total_amount,
       CASE
           WHEN total_amount < 5000  THEN 'Small'
           WHEN total_amount < 20000 THEN 'Medium'
           ELSE 'Large'
       END AS bill_category
FROM bill
ORDER BY total_amount DESC;

-- Patient-er lab result ar suggest kora doctor 
SELECT p.name AS patient_name, d.name AS suggested_by,
       lt.test_name, pt.test_date, pt.result
FROM patient_test pt
JOIN patient p   ON pt.patient_id = p.patient_id
JOIN lab_test lt ON pt.test_id    = lt.test_id
LEFT JOIN doctor d ON pt.doctor_id = d.doctor_id
ORDER BY pt.test_date DESC;

-- Room type onujayi occupied, available ar total room-er full breakdown
SELECT room_type,
       COUNT(*) FILTER (WHERE status = 'Occupied')  AS occupied,
       COUNT(*) FILTER (WHERE status = 'Available') AS available,
       COUNT(*) AS total_rooms
FROM room
GROUP BY room_type
ORDER BY room_type;

-- Prescription-er medicine cost, patient ar diagnosis
SELECT p.name AS patient_name, pr.presc_id, pr.diagnosis,
       (SELECT SUM(m.unit_price)
        FROM presc_medicine pm
        JOIN medicine m ON pm.med_id = m.med_id
        WHERE pm.presc_id = pr.presc_id) AS medicine_cost
FROM prescription pr
JOIN appointment a ON pr.appt_id = a.appt_id
JOIN patient p ON a.patient_id = p.patient_id
ORDER BY medicine_cost DESC NULLS LAST;