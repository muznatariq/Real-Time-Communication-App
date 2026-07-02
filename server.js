const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { v4: uuidV4 } = require('uuid');
const { ExpressPeerServer } = require('peer');

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/chatAppDB')
    .then(() => console.log("Database Connected Successfully"))
    .catch(err => console.log("DB Connection Error:", err));

const User = mongoose.model('User', new mongoose.Schema({ username: String, password: String }));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: 'secret_key', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use('/peerjs', ExpressPeerServer(server, { debug: true }));

// Passport Config
passport.use(new LocalStrategy(async (username, password, done) => {
    const user = await User.findOne({ username });
    if (!user) return done(null, false);
    if (await bcrypt.compare(password, user.password)) return done(null, user);
    return done(null, false);
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => done(null, await User.findById(id)));

// Routes
app.get('/login', (req, res) => res.render('login'));
app.post('/login', passport.authenticate('local', { successRedirect: '/', failureRedirect: '/login' }));

app.get('/register', (req, res) => res.render('register'));
app.post('/register', async (req, res) => {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await User.create({ username: req.body.username, password: hashedPassword });
    res.redirect('/login');
});

const checkAuth = (req, res, next) => (req.isAuthenticated() ? next() : res.redirect('/login'));
app.get('/', checkAuth, (req, res) => res.redirect(`/${uuidV4()}`));
app.get('/:room', checkAuth, (req, res) => res.render('room', { roomId: req.params.room }));

// Sockets
io.on('connection', socket => {
    socket.on('join-room', (roomId, userId) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId);
        socket.on('message', msg => io.to(roomId).emit('createMessage', msg));
        socket.on('draw', data => socket.to(roomId).emit('drawing', data));
        socket.on('file-message', file => socket.to(roomId).emit('file-receive', file));
        socket.on('disconnect', () => socket.to(roomId).emit('user-disconnected', userId));
    });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
