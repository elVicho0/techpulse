from __future__ import annotations

import json
import uuid
from fastapi import APIRouter, HTTPException

from app.db.connection import connect
from app.services.saved_service import save_item, unsave_item
from app.utils.time import utc_now_iso
from app.utils.url import sha256_text

router = APIRouter(tags=["ideas"])


def _idea_row_to_dict(r, conn):
    tech = json.loads(r["technologies_json"] or "[]")
    repos = conn.execute(
        "SELECT rp.id, rp.full_name, rp.html_url, ir.role FROM idea_repositories ir JOIN repositories rp ON rp.id=ir.repository_id WHERE ir.idea_id=?",
        (r["id"],),
    ).fetchall()
    fav = conn.execute("SELECT 1 FROM saved_items WHERE item_type='idea' AND item_id=?", (r["id"],)).fetchone()
    return {
        "id": r["id"], "title": r["title"], "summary": r["summary"], "problem": r["problem"], "how_it_works": r["how_it_works"],
        "technologies": tech, "difficulty": r["difficulty"], "category": r["category"], "expansion": r["expansion"],
        "portfolio_value": r["portfolio_value"], "status": r["status"], "favorite": bool(fav), "generated_by": r["generated_by"],
        "repositories": [dict(x) for x in repos], "created_at": r["created_at"], "updated_at": r["updated_at"],
    }


@router.get("/ideas")
def ideas(page: int = 1, page_size: int = 20, q: str | None = None, difficulty: str | None = None, category: str | None = None,
          status: str | None = None, favorite: bool | None = None, repository_id: int | None = None, sort: str = "updated", order: str = "desc"):
    page = max(1, page); page_size = min(100, max(1, page_size))
    conn = connect()
    try:
        where=["1=1"]; params=[]
        if q:
            like=f"%{q}%"; where.append("(title LIKE ? OR summary LIKE ? OR problem LIKE ?)"); params.extend([like,like,like])
        if difficulty:
            ds=[x.strip() for x in difficulty.split(',') if x.strip()]; where.append(f"difficulty IN ({','.join(['?']*len(ds))})"); params.extend(ds)
        if category:
            cs=[x.strip() for x in category.split(',') if x.strip()]; where.append(f"category IN ({','.join(['?']*len(cs))})"); params.extend(cs)
        if status:
            ss=[x.strip() for x in status.split(',') if x.strip()]; where.append(f"status IN ({','.join(['?']*len(ss))})"); params.extend(ss)
        if favorite is True:
            where.append("EXISTS (SELECT 1 FROM saved_items si WHERE si.item_type='idea' AND si.item_id=project_ideas.id)")
        elif favorite is False:
            where.append("NOT EXISTS (SELECT 1 FROM saved_items si WHERE si.item_type='idea' AND si.item_id=project_ideas.id)")
        if repository_id is not None:
            where.append("EXISTS (SELECT 1 FROM idea_repositories ir WHERE ir.idea_id=project_ideas.id AND ir.repository_id=?)"); params.append(repository_id)
        sort_map={"updated":"updated_at","created":"created_at","difficulty":"difficulty","title":"title"}
        scol=sort_map.get(sort,"updated_at"); ord_sql="ASC" if str(order).lower()=="asc" else "DESC"
        wh=" AND ".join(where)
        total=conn.execute(f"SELECT COUNT(*) c FROM project_ideas WHERE {wh}", params).fetchone()["c"]
        rows=conn.execute(f"SELECT * FROM project_ideas WHERE {wh} ORDER BY {scol} {ord_sql} LIMIT ? OFFSET ?", params+[page_size,(page-1)*page_size]).fetchall()
        return {"items":[_idea_row_to_dict(r,conn) for r in rows],"page":page,"page_size":page_size,"total":total,"has_next":page*page_size<total}
    finally:
        conn.close()


@router.post("/ideas/generate")
def generate_ideas(body: dict | None = None):
    body = body or {}
    repo_ids = body.get("repository_ids") or []
    max_ideas = min(20, max(1, int(body.get("max_ideas") or 5)))
    conn = connect()
    try:
        if repo_ids:
            for rid in repo_ids:
                if not conn.execute("SELECT 1 FROM repositories WHERE id=?", (rid,)).fetchone():
                    raise HTTPException(status_code=422, detail={"code":"VALIDATION_ERROR","message":f"Repository {rid} not found"})
            rows = conn.execute(f"SELECT * FROM repositories WHERE id IN ({','.join(['?']*len(repo_ids))}) ORDER BY interest_score DESC", repo_ids).fetchall()
        else:
            rows = conn.execute("SELECT * FROM repositories WHERE archived=0 AND disabled=0 ORDER BY interest_score DESC LIMIT 10").fetchall()
        if not rows:
            return {"created": [], "skipped": 0, "reason": "No hay suficientes repositorios relacionados."}
        created = []; skipped = 0; now = utc_now_iso()
        for r in rows[:max_ideas]:
            gkey = sha256_text(f"auto_repo|{r['id']}|intermediate|{r['category']}")
            if conn.execute("SELECT 1 FROM project_ideas WHERE generation_key=?", (gkey,)).fetchone():
                skipped += 1; continue
            title = f"Proyecto con {r['name']}"
            summary = f"Idea basada en el repositorio real {r['full_name']} para explorar su categoría {r['category']}."
            problem = "Necesidad de un proyecto práctico y trazable a herramientas reales."
            how = f"Usar {r['full_name']} como componente principal y construir un flujo reproducible alrededor de sus capacidades."
            tech = [x for x in [r['language'], r['category']] if x]
            cur = conn.execute(
                """INSERT INTO project_ideas(title,summary,problem,how_it_works,technologies_json,difficulty,category,expansion,portfolio_value,status,generated_by,generation_key,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (title, summary, problem, how, json.dumps(tech), "intermediate", r['category'], None, "portfolio", "pending", "rules", gkey, now, now),
            )
            iid = cur.lastrowid
            conn.execute("INSERT OR IGNORE INTO idea_repositories(idea_id,repository_id,role) VALUES (?,?,?)", (iid, r['id'], 'inspiration'))
            created.append(_idea_row_to_dict(conn.execute("SELECT * FROM project_ideas WHERE id=?", (iid,)).fetchone(), conn))
        conn.commit()
        return {"created": created, "skipped": skipped, "reason": None if created else "No se generaron ideas nuevas."}
    finally:
        conn.close()


@router.get("/ideas/{idea_id}")
def get_idea(idea_id: int):
    conn = connect()
    try:
        r = conn.execute("SELECT * FROM project_ideas WHERE id=?", (idea_id,)).fetchone()
        if not r: raise HTTPException(status_code=404, detail={"code":"IDEA_NOT_FOUND","message":"Idea not found"})
        return _idea_row_to_dict(r, conn)
    finally:
        conn.close()


@router.patch("/ideas/{idea_id}")
def patch_idea(idea_id: int, body: dict):
    conn = connect()
    try:
        r = conn.execute("SELECT * FROM project_ideas WHERE id=?", (idea_id,)).fetchone()
        if not r: raise HTTPException(status_code=404, detail={"code":"IDEA_NOT_FOUND","message":"Idea not found"})
        allowed = {"title","summary","problem","how_it_works","technologies","difficulty","category","expansion","portfolio_value","status","favorite"}
        updates = {k:v for k,v in body.items() if k in allowed}
        if "favorite" in updates:
            fav = updates.pop("favorite")
            if fav: save_item("idea", idea_id)
            else: unsave_item("idea", idea_id)
        if "technologies" in updates:
            updates["technologies_json"] = json.dumps(updates.pop("technologies"))
        if updates:
            sets = ", ".join([f"{k}=?" for k in updates.keys()])
            conn.execute(f"UPDATE project_ideas SET {sets}, updated_at=? WHERE id=?", list(updates.values())+[utc_now_iso(), idea_id])
            conn.commit()
        r2 = conn.execute("SELECT * FROM project_ideas WHERE id=?", (idea_id,)).fetchone()
        return _idea_row_to_dict(r2, conn)
    finally:
        conn.close()


@router.post("/ideas/{idea_id}/favorite")
def fav_idea(idea_id: int):
    save_item("idea", idea_id)
    return get_idea(idea_id)


@router.delete("/ideas/{idea_id}/favorite")
def unfav_idea(idea_id: int):
    unsave_item("idea", idea_id)
    return get_idea(idea_id)
