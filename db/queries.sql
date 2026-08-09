-- Query 1: Dr. Rezaul Karim (doctor_id=1) er shob patient ar tader appointment date
SELECT d.name AS doctor_name, p.name AS patient_name,
       a.appt_date, a.status
FROM appointment a
JOIN doctor d ON a.doctor_id = d.doctor_id
JOIN patient p ON a.patient_id = p.patient_id
WHERE d.doctor_id = 1
ORDER BY a.appt_date;

-- Query 2: Protita department e koto jon doctor ache
SELECT dep.dept_name, COUNT(d.doctor_id) AS total_doctors
FROM department dep
LEFT JOIN doctor d ON dep.dept_id = d.dept_id
GROUP BY dep.dept_name
ORDER BY total_doctors DESC;

-- Query 3: Protita patient er total bill koto (jader bill ache)
SELECT p.name AS patient_name,
       SUM(b.total_amount) AS total_billed
FROM patient p
JOIN bill b ON p.patient_id = b.patient_id
GROUP BY p.name
ORDER BY total_billed DESC;

-- Query 4: Ekhon kon kon room khali ache
SELECT room_no, room_type, daily_charge
FROM room
WHERE status = 'Available'
ORDER BY daily_charge;

-- Query 5: Kon medicine er stock kom (1500 er niche)
SELECT name, unit_price, stock_qty
FROM medicine
WHERE stock_qty < 1500
ORDER BY stock_qty ASC;

-- Query 6: Protimashe koto ta appointment hoyeche
SELECT TO_CHAR(appt_date, 'YYYY-MM') AS month,
       COUNT(*) AS total_appointments
FROM appointment
GROUP BY TO_CHAR(appt_date, 'YYYY-MM')
ORDER BY month;

-- Query 7: Department wise average consultation fee
SELECT dep.dept_name,
       ROUND(AVG(d.consult_fee), 2) AS avg_fee
FROM doctor d
JOIN department dep ON d.dept_id = dep.dept_id
GROUP BY dep.dept_name
ORDER BY avg_fee DESC;

-- Query 8: Jader bill ekhono full paid hoyni
SELECT p.name AS patient_name, p.phone,
       b.bill_id, b.total_amount, b.pay_status
FROM patient p
JOIN bill b ON p.patient_id = b.patient_id
WHERE b.pay_status IN ('Unpaid', 'Partial')
ORDER BY b.total_amount DESC;

-- Query 9: Sobcheye beshi prescribe kora hoyeche emon top 5 medicine
SELECT m.name, COUNT(pm.presc_id) AS times_prescribed
FROM medicine m
JOIN presc_medicine pm ON m.med_id = pm.med_id
GROUP BY m.name
ORDER BY times_prescribed DESC
LIMIT 5;

-- Query 10: Protita patient er sobcheye recent appointment
SELECT p.name AS patient_name, MAX(a.appt_date) AS last_visit
FROM patient p
JOIN appointment a ON p.patient_id = a.patient_id
GROUP BY p.name
ORDER BY last_visit DESC;

-- Query 11: Kon doctor er kon schedule ekhon active na
SELECT d.name AS doctor_name, ds.day_of_week, ds.start_time, ds.end_time
FROM doctor_schedule ds
JOIN doctor d ON ds.doctor_id = d.doctor_id
WHERE ds.is_active = FALSE;

-- Query 12: Protita doctor koto taka income korlo (completed appointment theke)
SELECT d.name AS doctor_name,
       COUNT(a.appt_id) AS completed_appointments,
       COUNT(a.appt_id) * d.consult_fee AS total_income
FROM doctor d
JOIN appointment a ON d.doctor_id = a.doctor_id
WHERE a.status = 'Completed'
GROUP BY d.name, d.consult_fee
ORDER BY total_income DESC;


-- Query 13: Window function - patient der total bill onujayi rank
SELECT p.name AS patient_name,
       SUM(b.total_amount) AS total_billed,
       RANK() OVER (ORDER BY SUM(b.total_amount) DESC) AS bill_rank
FROM patient p
JOIN bill b ON p.patient_id = b.patient_id
GROUP BY p.name;


-- Query 14: HAVING - jei department e 1 tar beshi doctor ache
SELECT dep.dept_name, COUNT(d.doctor_id) AS doctor_count
FROM department dep
JOIN doctor d ON dep.dept_id = d.dept_id
GROUP BY dep.dept_name
HAVING COUNT(d.doctor_id) > 1
ORDER BY doctor_count DESC;


-- Query 15: Correlated subquery - jader kono appointment kokhono cancel hoyni
SELECT p.name AS patient_name
FROM patient p
WHERE NOT EXISTS (
    SELECT 1 FROM appointment a
    WHERE a.patient_id = p.patient_id AND a.status = 'Cancelled'
)
AND EXISTS (
    SELECT 1 FROM appointment a WHERE a.patient_id = p.patient_id
);


-- Query 16: EXISTS - kon doctor kokhono medicine prescribe koreni (jader kaj kom)
SELECT d.name AS doctor_name
FROM doctor d
WHERE NOT EXISTS (
    SELECT 1
    FROM appointment a
    JOIN prescription pr ON a.appt_id = pr.appt_id
    WHERE a.doctor_id = d.doctor_id
);


-- Query 17: CASE - bill gulo ke amount onujayi category kora
SELECT bill_id, total_amount,
       CASE
           WHEN total_amount < 5000  THEN 'Small'
           WHEN total_amount < 20000 THEN 'Medium'
           ELSE 'Large'
       END AS bill_category
FROM bill
ORDER BY total_amount DESC;


-- Query 18: Multi-join - lab test full report (patient + doctor + test name)
SELECT p.name AS patient_name, d.name AS suggested_by,
       lt.test_name, pt.test_date, pt.result
FROM patient_test pt
JOIN patient p   ON pt.patient_id = p.patient_id
JOIN lab_test lt ON pt.test_id    = lt.test_id
LEFT JOIN doctor d ON pt.doctor_id = d.doctor_id
ORDER BY pt.test_date DESC;


-- Query 19: Room utilization - room type onujayi koyta occupied, koyta available
SELECT room_type,
       COUNT(*) FILTER (WHERE status = 'Occupied')  AS occupied,
       COUNT(*) FILTER (WHERE status = 'Available') AS available,
       COUNT(*) AS total_rooms
FROM room
GROUP BY room_type
ORDER BY room_type;


-- Query 20: Protita patient er sobcheye dami prescription (nested subquery)
SELECT p.name AS patient_name, pr.presc_id, pr.diagnosis,
       (SELECT SUM(m.unit_price)
        FROM presc_medicine pm
        JOIN medicine m ON pm.med_id = m.med_id
        WHERE pm.presc_id = pr.presc_id) AS medicine_cost
FROM prescription pr
JOIN appointment a ON pr.appt_id = a.appt_id
JOIN patient p ON a.patient_id = p.patient_id
ORDER BY medicine_cost DESC NULLS LAST;