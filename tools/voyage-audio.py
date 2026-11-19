#!/usr/bin/env python3
"""Génère le son des unités de « Mon voyage » avec la Sproochmaschinn (voix Maxine et Claude, usage non commercial).

Usage : python3 tools/voyage-audio.py tools/voyage-audio.json
Écrit assets/audio/voyage/<unité>/<id>.mp3 (mono, 64 kb/s). Respecte la limite de 10 demandes par minute.
Un clip déjà présent n'est pas régénéré (supprimer le fichier pour le refaire).
Conditions : https://sproochmaschinn.lu (API non commerciale). Voix « max » interdite ici (non commerciale, non téléchargeable).
"""
import base64, json, os, subprocess, sys, tempfile, time, urllib.request

BASE = "https://sproochmaschinn.lu"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def main(manifest_path):
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    out_dir = os.path.join(ROOT, "assets", "audio", "voyage", manifest["unit"])
    os.makedirs(out_dir, exist_ok=True)
    sid = call("POST", "/api/session")["session_id"]
    done = {}  # (voix, texte) -> fichier déjà produit
    for clip in manifest["clips"]:
        if clip["voice"] == "max":
            raise SystemExit("La voix « max » n'est pas autorisée ici.")
        target = os.path.join(out_dir, clip["id"] + ".mp3")
        key = (clip["voice"], clip["text"])
        if os.path.exists(target):
            continue
        if key in done:
            with open(done[key], "rb") as src, open(target, "wb") as dst:
                dst.write(src.read())
            print("copie", clip["id"])
            continue
        time.sleep(7.5)
        rid = call("POST", f"/api/tts/{sid}", {"text": clip["text"], "model": clip["voice"]})["request_id"]
        for _ in range(90):
            res = call("GET", f"/api/result/{rid}")
            if res.get("status") == "completed":
                break
            time.sleep(1)
        wav = base64.b64decode(res["result"]["data"])
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(wav)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-b:a", "64k", target], check=True)
        os.unlink(tmp.name)
        done[key] = target
        print("ok", clip["id"], clip["voice"], round(res["result"].get("duration", 0), 1), "s")


if __name__ == "__main__":
    main(sys.argv[1])
