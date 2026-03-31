const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// ==================== AUTHENTIFICATION ====================

// Route d'inscription
app.post('/api/v1/auth/register', async (req, res) => {
  console.log('?? Inscription:', req.body.email);
  
  const { email, password, fullName, role = 'doctor' } = req.body;
  
  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }
    
    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Créer l'utilisateur
    const result = await pool.query(
      'INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name',
      [email, hashedPassword, fullName, role]
    );
    
    const newUser = result.rows[0];
    console.log('? Utilisateur créé:', newUser.email);
    
    res.json({
      success: true,
      message: 'Inscription réussie',
      user: newUser
    });
    
  } catch (err) {
    console.error('? Erreur inscription:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Route de connexion
app.post('/api/v1/auth/login', async (req, res) => {
  console.log('?? Connexion:', req.body.email);
  
  const { email, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }
    
    console.log('? Connexion réussie:', user.email);
    
    res.json({
      success: true,
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
    
  } catch (err) {
    console.error('? Erreur connexion:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// Route de test
app.get('/api/v1', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    const count = result.rows[0].count;
    res.json({
      message: 'API GynoCare works!',
      status: 'ok',
      usersCount: parseInt(count)
    });
  } catch (err) {
    res.json({
      message: 'API GynoCare works!',
      status: 'ok',
      usersCount: 0
    });
  }
});

// ==================== PATIENTS ====================

// Récupérer tous les patients
app.get('/api/v1/patients', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.full_name, u.email 
      FROM patients p 
      JOIN users u ON p.user_id = u.id 
      WHERE u.role = 'patient'
      ORDER BY u.full_name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer un patient par ID
app.get('/api/v1/patients/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.full_name, u.email 
      FROM patients p 
      JOIN users u ON p.user_id = u.id 
      WHERE p.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un patient
app.post('/api/v1/patients', async (req, res) => {
  const { userId, phone, birthDate, bloodType, allergies, chronicDiseases, surgeries, familyHistory } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO patients (user_id, phone, birth_date, blood_type, allergies, chronic_diseases, surgeries, family_history)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [userId, phone, birthDate, bloodType, allergies, chronicDiseases, surgeries, familyHistory]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== CONSULTATIONS ====================

// Récupérer les consultations d'un patient
app.get('/api/v1/patients/:patientId/consultations', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.full_name as doctor_name
      FROM consultations c
      JOIN users u ON c.doctor_id = u.id
      WHERE c.patient_id = $1
      ORDER BY c.date DESC
    `, [req.params.patientId]);
    res.json(result.rows);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter une consultation
app.post('/api/v1/consultations', async (req, res) => {
  const { patientId, doctorId, date, reason, diagnosis, prescription, notes } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO consultations (patient_id, doctor_id, date, reason, diagnosis, prescription, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [patientId, doctorId, date, reason, diagnosis, prescription, notes]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== RENDEZ-VOUS ====================

// Récupérer tous les rendez-vous (pour le dashboard)
// Récupérer tous les rendez-vous
app.get('/api/v1/appointments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.full_name as patient_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      ORDER BY a.date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Récupérer les rendez-vous d'un médecin
app.get('/api/v1/appointments/doctor/:doctorId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.full_name as patient_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE a.doctor_id = $1
      ORDER BY a.date ASC
    `, [req.params.doctorId]);
    res.json(result.rows);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un rendez-vous
app.post('/api/v1/appointments', async (req, res) => {
  const { patientId, doctorId, date, duration, reason } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO appointments (patient_id, doctor_id, date, duration, reason, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [patientId, doctorId, date, duration, reason]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour le statut d'un rendez-vous
app.patch('/api/v1/appointments/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const result = await pool.query(`
      UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *
    `, [status, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== MESSAGES (CHAT) ====================

// Récupérer les messages entre un médecin et un patient
app.get('/api/v1/messages/:doctorId/:patientId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM messages
      WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $3 AND receiver_id = $4)
      ORDER BY created_at ASC
    `, [req.params.doctorId, req.params.patientId, req.params.patientId, req.params.doctorId]);
    res.json(result.rows);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Envoyer un message
app.post('/api/v1/messages', async (req, res) => {
  const { senderId, receiverId, patientId, message, fileUrl, fileType } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO messages (sender_id, receiver_id, patient_id, message, file_url, file_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [senderId, receiverId, patientId, message, fileUrl, fileType]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== PRESCRIPTIONS ====================

// Récupérer les prescriptions d'un patient
app.get('/api/v1/prescriptions/patient/:patientId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.full_name as doctor_name
      FROM prescriptions p
      JOIN users u ON p.doctor_id = u.id
      WHERE p.patient_id = $1
      ORDER BY p.date DESC
    `, [req.params.patientId]);
    res.json(result.rows);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une prescription
app.post('/api/v1/prescriptions', async (req, res) => {
  const { patientId, doctorId, medications, dosage, duration, notes, pdfUrl } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO prescriptions (patient_id, doctor_id, medications, dosage, duration, notes, pdf_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [patientId, doctorId, medications, dosage, duration, notes, pdfUrl]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== GROSSESSES ====================

// Récupérer les grossesses d'une patiente
app.get('/api/v1/pregnancies/patient/:patientId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM pregnancies
      WHERE patient_id = $1
      ORDER BY start_date DESC
    `, [req.params.patientId]);
    res.json(result.rows);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Ajouter une grossesse
app.post('/api/v1/pregnancies', async (req, res) => {
  const { patientId, startDate, dueDate, notes } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO pregnancies (patient_id, start_date, due_date, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [patientId, startDate, dueDate, notes]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== NOTIFICATIONS ====================

// Récupérer les notifications d'un utilisateur
app.get('/api/v1/notifications/:userId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.params.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Marquer une notification comme lue
app.patch('/api/v1/notifications/:id/read', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('? Erreur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== DÉMARRAGE ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`?? Serveur démarré sur http://localhost:${PORT}`);
  console.log(`?? Accessible sur le réseau: http://192.168.1.97:${PORT}`);
});