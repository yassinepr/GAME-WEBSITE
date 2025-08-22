
import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import session from "express-session";
import multer from "multer";
import slugify from "slugify";

dotenv.config();
const app = express();
const __dirname = path.resolve();

// Storage
const DATA_DIR = path.join(__dirname, "data");
const GAMES_JSON = path.join(DATA_DIR, "games.json");
const CATEGORIES_JSON = path.join(DATA_DIR, "categories.json");
const ensureData = () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(GAMES_JSON)) fs.writeFileSync(GAMES_JSON, JSON.stringify([] , null, 2));
  if (!fs.existsSync(CATEGORIES_JSON)) fs.writeFileSync(CATEGORIES_JSON, JSON.stringify(["Arcade","Puzzle","Action","Sport","Classiques"], null, 2));
};
ensureData();

// Middlewares
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave:false, saveUninitialized:false
}));

// Multer upload for game thumbnails
const upload = multer({ dest: path.join(__dirname, "public", "uploads") });

// Helpers
function loadGames(){return JSON.parse(fs.readFileSync(GAMES_JSON, "utf-8"));}
function saveGames(g){fs.writeFileSync(GAMES_JSON, JSON.stringify(g, null, 2));}
function loadCategories(){return JSON.parse(fs.readFileSync(CATEGORIES_JSON, "utf-8"));}

// Auth helpers
function requireAdmin(req,res,next){ if(req.session.user==="admin") return next(); return res.redirect("/admin/login?next="+encodeURIComponent(req.originalUrl)); }

// Routes
app.get("/", (req,res)=>{
  const games = loadGames();
  const q = (req.query.q || "").toLowerCase();
  const cat = req.query.cat || "";
  let filtered = games;
  if(q) filtered = filtered.filter(g => g.title.toLowerCase().includes(q));
  if(cat) filtered = filtered.filter(g => g.category === cat);
  res.render("home", { games: filtered, categories: loadCategories(), q, cat, user:req.session.user });
});

app.get("/game/:slug", (req,res)=>{
  const games = loadGames();
  const game = games.find(g => g.slug === req.params.slug);
  if(!game) return res.status(404).render("404");
  res.render("game", { game, user:req.session.user, autoplay: req.query.autoplay==='1' });
});

// Admin
app.get("/admin/login", (req,res)=>{
  res.render("admin/login", { error:null, next:req.query.next||"/admin" });
});
app.post("/admin/login", (req,res)=>{
  const {username, password} = req.body;
  if(username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD){
    req.session.user = "admin";
    return res.redirect(req.body.next || "/admin");
  }
  res.status(401).render("admin/login", { error:"Identifiants invalides", next:req.body.next||"/admin" });
});
app.post("/admin/logout", (req,res)=>{
  req.session.destroy(()=>res.redirect("/"));
});

app.get("/admin", requireAdmin, (req,res)=>{
  res.render("admin/dashboard", { games: loadGames(), categories: loadCategories(), user:req.session.user });
});

app.get("/admin/games/new", requireAdmin, (req,res)=>{
  res.render("admin/new", { categories: loadCategories(), user:req.session.user });
});

app.post("/admin/games", requireAdmin, upload.single("thumbnail"), (req,res)=>{
  const games = loadGames();
  const { title, category, description, type, url, controls } = req.body;
  const slug = slugify(title, { lower:true, strict:true });
  const exists = games.some(g => g.slug === slug);
  let thumbPath = req.file ? `/uploads/${req.file.filename}` : "/img/placeholder.png";

  const record = {
    id: Date.now(),
    slug,
    title,
    category,
    description,
    type, // iframe or local
    url,  // iframe src or local path
    thumbnail: thumbPath,
    createdAt: new Date().toISOString(),
    controls: (controls||'').split('\n').filter(Boolean).map(l=>{ const p=l.split(':'); return {key:(p[0]||'').trim(), action:(p.slice(1).join(':')||'').trim()}; })
  };
  if(exists) return res.status(400).send("Titre déjà utilisé");
  games.push(record);
  saveGames(games);
  res.redirect("/admin");
});

app.get("/admin/games/:id/edit", requireAdmin, (req,res)=>{
  const games = loadGames();
  const game = games.find(g => g.id == req.params.id);
  if(!game) return res.status(404).render("404");
  res.render("admin/edit", { game, categories: loadCategories(), user:req.session.user });
});

app.post("/admin/games/:id", requireAdmin, upload.single("thumbnail"), (req,res)=>{
  const games = loadGames();
  const idx = games.findIndex(g => g.id == req.params.id);
  if(idx===-1) return res.status(404).render("404");
  const g = games[idx];
  const { title, category, description, type, url, controls } = req.body;
  g.title = title; g.category = category; g.description = description; g.type = type; g.url = url;
  g.controls = (controls||'').split('\n').filter(Boolean).map(l=>{ const p=l.split(':'); return {key:(p[0]||'').trim(), action:(p.slice(1).join(':')||'').trim()}; });
  if(req.file) g.thumbnail = `/uploads/${req.file.filename}`;
  saveGames(games);
  res.redirect("/admin");
});

app.post("/admin/games/:id/delete", requireAdmin, (req,res)=>{
  let games = loadGames();
  games = games.filter(g => g.id != req.params.id);
  saveGames(games);
  res.redirect("/admin");
});

// 404
app.use((req,res)=> res.status(404).render("404"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`✅ Serveur démarré sur http://localhost:${PORT}`));
