
// Run with: node tools/bulk-scan.mjs
import fs from "fs";
import path from "path";
const ROOT = path.resolve();
const GAMES = path.join(ROOT, "public", "games");
const DATA = path.join(ROOT, "data", "games.json");
const categories = ["Arcade","Puzzle","Action","Sport","Classiques"];
const existing = JSON.parse(fs.readFileSync(DATA,"utf-8"));
let nextId = existing.reduce((m,g)=>Math.max(m,g.id),0)+1;
for (const dir of fs.readdirSync(GAMES)) {
  const p = path.join(GAMES, dir, "index.html");
  if (fs.existsSync(p)) {
    const slug = dir.toLowerCase();
    if (existing.some(g=>g.slug===slug)) continue;
    const rec = {
      id: nextId++,
      slug,
      title: dir.replace(/[-_]/g,' ').replace(/\b\w/g, s=>s.toUpperCase()),
      category: categories[Math.floor(Math.random()*categories.length)],
      description: "Jeu importé automatiquement.",
      type: "local",
      url: `/games/${dir}/index.html`,
      thumbnail: "/img/placeholder.png",
      createdAt: new Date().toISOString(),
      controls: []
    };
    existing.push(rec);
    console.log("Added:", rec.slug);
  }
}
fs.writeFileSync(DATA, JSON.stringify(existing,null,2));
console.log("Done.");
