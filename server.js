require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(dataDir, "study_planner.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS students (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, course TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, title TEXT NOT NULL,
 subject TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL, duration INTEGER NOT NULL DEFAULT 60,
 priority TEXT NOT NULL DEFAULT 'medium', completed INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
);`);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: { directives: {
 defaultSrc:["'self'"], styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],
 fontSrc:["'self'","https://fonts.gstatic.com","data:"], scriptSrc:["'self'"], imgSrc:["'self'","data:"]
}}}));
app.use(express.urlencoded({extended:false,limit:"20kb"}));
app.use(express.json({limit:"20kb"}));
app.use(express.static(path.join(__dirname,"public")));
if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
 throw new Error("Set SESSION_SECRET to a random value of at least 32 characters in production.");
}
app.set("trust proxy", production ? 1 : false);
app.use(session({
 store:new SQLiteStore({db:"sessions.db",dir:dataDir,concurrentDB:true}),
 secret:process.env.SESSION_SECRET || "development-only-change-this-secret-please",
 resave:false,saveUninitialized:false,
 cookie:{httpOnly:true,sameSite:"lax",secure:production,maxAge:8*60*60*1000}
}));
const clean = (v,max=120)=>String(v??"").trim().slice(0,max);
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length<=190;
const fail = (res,status,error)=>res.status(status).json({error});
const safeStudent = s => ({id:s.id,name:s.name,email:s.email,course:s.course,created_at:s.created_at});
function requireStudent(req,res,next){if(!req.session.studentId)return fail(res,401,"Please log in first.");next();}
function requireAdmin(req,res,next){if(!req.session.isAdmin)return fail(res,401,"Admin login required.");next();}

app.get("/api/me",(req,res)=>{
 if(req.session.isAdmin)return res.json({role:"admin"});
 if(!req.session.studentId)return res.json({role:"guest"});
 const s=db.prepare("SELECT id,name,email,course,created_at FROM students WHERE id=?").get(req.session.studentId);
 if(!s){req.session.destroy(()=>{});return res.json({role:"guest"});}
 res.json({role:"student",student:safeStudent(s)});
});
app.post("/api/register",async(req,res)=>{
 const name=clean(req.body.name,80),email=clean(req.body.email,190).toLowerCase(),course=clean(req.body.course,100),password=String(req.body.password??"");
 if(name.length<2)return fail(res,400,"Name must contain at least 2 characters.");
 if(!emailOk(email))return fail(res,400,"Enter a valid email address.");
 if(password.length<8||password.length>72)return fail(res,400,"Password must be between 8 and 72 characters.");
 if(db.prepare("SELECT id FROM students WHERE email=?").get(email))return fail(res,409,"This email is already registered. Please log in.");
 try{
  const hash=await bcrypt.hash(password,12);
  const result=db.prepare("INSERT INTO students(name,email,password_hash,course) VALUES(?,?,?,?)").run(name,email,hash,course);
  req.session.studentId=Number(result.lastInsertRowid);req.session.isAdmin=false;
  res.status(201).json({message:"Account created. Your details are saved in the database.",student:{id:Number(result.lastInsertRowid),name,email,course}});
 }catch(e){console.error(e);fail(res,500,"Could not create account. Please try again.");}
});
app.post("/api/login",async(req,res)=>{
 const email=clean(req.body.email,190).toLowerCase(),password=String(req.body.password??"");
 const s=db.prepare("SELECT * FROM students WHERE email=?").get(email);
 if(!s||!(await bcrypt.compare(password,s.password_hash)))return fail(res,401,"Incorrect email or password.");
 req.session.regenerate(err=>{
  if(err)return fail(res,500,"Could not start session.");
  req.session.studentId=s.id;req.session.isAdmin=false;res.json({message:"Welcome back!",student:safeStudent(s)});
 });
});
app.post("/api/logout",(req,res)=>req.session.destroy(err=>{
 if(err)return fail(res,500,"Could not log out.");res.clearCookie("connect.sid");res.json({message:"Logged out."});
}));
app.get("/api/tasks",requireStudent,(req,res)=>{
 const tasks=db.prepare("SELECT id,title,subject,due_date,duration,priority,completed,created_at FROM tasks WHERE student_id=? ORDER BY completed ASC,due_date ASC,id DESC").all(req.session.studentId);
 res.json({tasks});
});
app.post("/api/tasks",requireStudent,(req,res)=>{
 const title=clean(req.body.title,120),subject=clean(req.body.subject,60),due=clean(req.body.due_date,10);
 const duration=Number(req.body.duration),priority=["low","medium","high"].includes(req.body.priority)?req.body.priority:"medium";
 if(!title)return fail(res,400,"Task title is required.");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number.isNaN(Date.parse(due+"T00:00:00Z")))return fail(res,400,"Choose a valid due date.");
 if(!Number.isInteger(duration)||duration<5||duration>1440)return fail(res,400,"Duration must be between 5 and 1440 minutes.");
 const result=db.prepare("INSERT INTO tasks(student_id,title,subject,due_date,duration,priority) VALUES(?,?,?,?,?,?)").run(req.session.studentId,title,subject,due,duration,priority);
 const task=db.prepare("SELECT id,title,subject,due_date,duration,priority,completed FROM tasks WHERE id=?").get(result.lastInsertRowid);
 res.status(201).json({message:"Task added.",task});
});
app.patch("/api/tasks/:id/toggle",requireStudent,(req,res)=>{
 const id=Number(req.params.id),task=db.prepare("SELECT id,completed FROM tasks WHERE id=? AND student_id=?").get(id,req.session.studentId);
 if(!task)return fail(res,404,"Task not found.");
 const completed=task.completed?0:1;
 db.prepare("UPDATE tasks SET completed=? WHERE id=? AND student_id=?").run(completed,id,req.session.studentId);
 res.json({message:completed?"Task completed.":"Task reopened.",completed:Boolean(completed)});
});
app.delete("/api/tasks/:id",requireStudent,(req,res)=>{
 const result=db.prepare("DELETE FROM tasks WHERE id=? AND student_id=?").run(Number(req.params.id),req.session.studentId);
 if(!result.changes)return fail(res,404,"Task not found.");res.json({message:"Task deleted."});
});
app.post("/api/admin/login",(req,res)=>{
 const email=clean(req.body.email,190).toLowerCase(),password=String(req.body.password??"");
 const adminEmail=clean(process.env.ADMIN_EMAIL||"admin@example.com",190).toLowerCase();
 const adminPassword=process.env.ADMIN_PASSWORD||"ChangeThisAdminPassword123!";
 if(email!==adminEmail||password!==adminPassword)return fail(res,401,"Incorrect admin email or password.");
 req.session.regenerate(err=>{
  if(err)return fail(res,500,"Could not start admin session.");
  req.session.isAdmin=true;res.json({message:"Admin login successful."});
 });
});
app.get("/api/admin/students",requireAdmin,(req,res)=>{
 const students=db.prepare(`SELECT s.id,s.name,s.email,s.course,s.created_at,COUNT(t.id) total_tasks,
 SUM(CASE WHEN t.completed=1 THEN 1 ELSE 0 END) completed_tasks
 FROM students s LEFT JOIN tasks t ON t.student_id=s.id GROUP BY s.id ORDER BY s.created_at DESC`).all()
 .map(s=>({...s,completed_tasks:s.completed_tasks||0}));
 res.json({students,total:students.length});
});
app.get("/health",(req,res)=>res.json({status:"ok",service:"smart-study-planner"}));
app.use((req,res)=>req.path.startsWith("/api/")?fail(res,404,"API route not found."):res.status(404).send("Page not found."));
const server=app.listen(PORT,"0.0.0.0",()=>console.log(`Smart Study Planner: http://localhost:${PORT}\nDatabase: ${dbPath}`));
function shutdown(){server.close(()=>{db.close();process.exit(0);});}
process.on("SIGINT",shutdown);process.on("SIGTERM",shutdown);
