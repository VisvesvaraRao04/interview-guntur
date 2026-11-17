const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express(); const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(cors()); app.use(express.json());
const users = []; const slots = [
 { id:'slot-1', date:'2025-07-18', startTime:'09:30', endTime:'10:00', interviewer:'Ananya Rao', interviewType:'Technical', mode:'Online', capacity:5, availableSeats:3, status:'available' },
 { id:'slot-2', date:'2025-07-18', startTime:'11:00', endTime:'11:45', interviewer:'Marcus Chen', interviewType:'Managerial', mode:'Online', capacity:5, availableSeats:0, status:'full' },
 { id:'slot-3', date:'2025-07-18', startTime:'14:00', endTime:'14:30', interviewer:'Priya Shah', interviewType:'HR', mode:'Offline', capacity:6, availableSeats:4, status:'available' }
]; const bookings = [];
const token = user => jwt.sign({ id:user.id, role:user.role }, process.env.JWT_SECRET || 'interview-dev-secret', {expiresIn:'1d'});
function auth(req,res,next){try{const t=req.headers.authorization?.split(' ')[1];req.user=jwt.verify(t,process.env.JWT_SECRET||'interview-dev-secret');next()}catch(e){res.status(401).json({message:'Authentication required'})}}
function admin(req,res,next){if(req.user.role!=='admin')return res.status(403).json({message:'Admin access required'});next()}
app.get('/api/health',(req,res)=>res.json({ok:true,service:'interview-slots'}));
app.post('/api/auth/register',async(req,res)=>{const {name,email,password,role='candidate'}=req.body;if(!name||!email||!password)return res.status(400).json({message:'Name, email and password are required'});if(users.some(u=>u.email===email))return res.status(409).json({message:'Email already registered'});const user={id:Date.now().toString(),name,email,password:await bcrypt.hash(password,10),role};users.push(user);res.status(201).json({user:{id:user.id,name,email,role},token:token(user)})});
app.post('/api/auth/login',async(req,res)=>{const user=users.find(u=>u.email===req.body.email);if(!user||!(await bcrypt.compare(req.body.password,user.password)))return res.status(401).json({message:'Invalid email or password'});res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role},token:token(user)})});
app.get('/api/slots',(req,res)=>res.json(slots));
app.post('/api/slots',auth,admin,(req,res)=>{const {date,startTime,endTime,interviewer,interviewType,mode,capacity}=req.body;const slot={id:'slot-'+Date.now(),date,startTime,endTime,interviewer,interviewType,mode,capacity:Number(capacity),availableSeats:Number(capacity),status:'available'};slots.push(slot);io.emit('slot-updated',slot);res.status(201).json(slot)});
app.patch('/api/slots/:id',auth,admin,(req,res)=>{const slot=slots.find(s=>s.id===req.params.id);if(!slot)return res.sendStatus(404);Object.assign(slot,req.body);io.emit('slot-updated',slot);res.json(slot)});
app.delete('/api/slots/:id',auth,admin,(req,res)=>{const i=slots.findIndex(s=>s.id===req.params.id);if(i<0)return res.sendStatus(404);slots[i].status='cancelled';io.emit('slot-cancelled',slots[i]);res.json(slots[i])});
app.post('/api/bookings',auth,(req,res)=>{const slot=slots.find(s=>s.id===req.body.slotId);if(!slot||slot.status==='cancelled')return res.status(404).json({message:'Slot unavailable'});if(!slot.availableSeats)return res.status(409).json({message:'Slot is full'});if(bookings.some(b=>b.candidateId===req.user.id&&b.slotId===slot.id&&b.status==='booked'))return res.status(409).json({message:'You already booked this slot'});slot.availableSeats--;slot.status=slot.availableSeats?'available':'full';const booking={id:'booking-'+Date.now(),candidateId:req.user.id,slotId:slot.id,bookingDate:new Date().toISOString(),status:'booked'};bookings.push(booking);io.emit('slot-booked',{slot,booking});if(slot.status==='full')io.emit('slot-full',slot);res.status(201).json(booking)});
app.get('/api/bookings',auth,(req,res)=>res.json(bookings.filter(b=>req.user.role==='admin'||b.candidateId===req.user.id)));
app.patch('/api/bookings/:id/cancel',auth,(req,res)=>{const b=bookings.find(x=>x.id===req.params.id);if(!b)return res.sendStatus(404);b.status='cancelled';const slot=slots.find(s=>s.id===b.slotId);if(slot){slot.availableSeats++;slot.status='available';io.emit('slot-cancelled',{slot,booking:b})}res.json(b)});
io.on('connection',socket=>{socket.emit('slots-snapshot',slots);socket.on('join-role',role=>socket.join(role))});
const port=process.env.PORT||4000; server.listen(port,()=>console.log(`Interview API listening on http://localhost:${port}`));
