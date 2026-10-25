const $=s=>document.querySelector(s);
async function api(url,options={}){const r=await fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json"},...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed.");return d}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function show(text,type="error"){$("#adminMessage").textContent=text;$("#adminMessage").className="message "+type}
function directory(){ $("#adminLoginView").hidden=true;$("#adminDirectory").hidden=false;load() }
async function load(){try{const d=await api("/api/admin/students");$("#studentCount").textContent=d.total;$("#studentsTable").innerHTML=d.students.length?d.students.map(s=>`<tr><td>${s.id}</td><td>${esc(s.name)}</td><td>${esc(s.email)}</td><td>${esc(s.course||"Not provided")}</td><td>${esc(s.created_at)}</td><td>${s.total_tasks}</td><td>${s.completed_tasks}</td></tr>`).join(""):'<tr><td colspan="7">No registrations yet.</td></tr>'}catch(e){show(e.message)}}
$("#adminLoginForm").addEventListener("submit",async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));try{await api("/api/admin/login",{method:"POST",body:JSON.stringify(body)});directory()}catch(err){show(err.message)}});
$("#refreshStudents").addEventListener("click",load);
$("#adminLogout").addEventListener("click",async()=>{try{await api("/api/logout",{method:"POST",body:"{}"})}finally{location.href="/admin.html"}});
async function init(){try{const d=await api("/api/me");if(d.role==="admin")directory()}catch{}}
init();
