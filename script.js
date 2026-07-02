const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const fileInput = document.getElementById('file-input');
const messages = document.getElementById('messages');
const myPeer = new Peer(undefined, { path: '/peerjs', host: '/', port: '3000' });

// --- Video & Screen Share Logic ---
navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
    const myVideo = document.createElement('video');
    myVideo.muted = true;
    addVideoStream(myVideo, stream);

    myPeer.on('call', call => {
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream', userStream => addVideoStream(video, userStream));
    });

    socket.on('user-connected', userId => connectToNewUser(userId, stream));
});

function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => video.play());
    videoGrid.append(video);
}

function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userStream => addVideoStream(video, userStream));
}

document.getElementById('share-screen-btn').addEventListener('click', () => {
    navigator.mediaDevices.getDisplayMedia({ video: true }).then(screenStream => {
        addVideoStream(document.createElement('video'), screenStream);
    });
});

// --- Whiteboard Logic ---
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
let drawing = false;
canvas.addEventListener('mousedown', () => drawing = true);
canvas.addEventListener('mouseup', () => { drawing = false; ctx.beginPath(); });
canvas.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
    socket.emit('draw', { x, y });
});
socket.on('drawing', (data) => { ctx.lineTo(data.x, data.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(data.x, data.y); });

// --- File Sharing Logic ---
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => { socket.emit('file-message', { name: file.name, data: ev.target.result }); };
    reader.readAsDataURL(file);
});
socket.on('file-receive', (file) => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${file.data}" download="${file.name}">Download ${file.name}</a>`;
    messages.appendChild(li);
});

// Join Room
socket.emit('join-room', ROOM_ID, 'user123');
