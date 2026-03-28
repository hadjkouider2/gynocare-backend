const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(express.json());

const users = [];

app.post('/api/v1/auth/register', async (req, res) => {
  console.log('Register attempt:', req.body.email);
  
  const { email, password, fullName } = req.body;
  
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ 
      success: false, 
      message: 'Cet email est deja utilise' 
    });
  }
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = {
    id: users.length + 1,
    email,
    fullName,
    password: hashedPassword,
    createdAt: new Date()
  };
  
  users.push(newUser);
  
  console.log('User created:', newUser.email);
  
  res.json({
    success: true,
    message: 'Inscription reussie',
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName
    }
  });
});

app.post('/api/v1/auth/login', async (req, res) => {
  console.log('Login attempt:', req.body.email);
  
  const { email, password } = req.body;
  
  const user = users.find(u => u.email === email);
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
  
  console.log('Login success:', user.email);
  
  res.json({
    success: true,
    message: 'Connexion reussie',
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName
    }
  });
});

app.get('/api/v1', (req, res) => {
  res.json({ 
    message: 'API GynoCare works!',
    status: 'ok',
    usersCount: users.length
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server started on http://localhost:' + PORT);
  console.log('Accessible on: http://192.168.1.97:' + PORT);
});
