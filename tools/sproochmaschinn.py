"""Petit client de la Sproochmaschinn (Zenter fir d'Lëtzebuerger Sprooch) : synthèse vocale et reconnaissance vocale.
Usage non commercial uniquement (voir docs/VOYAGE.md). Respecte la limite de 10 demandes par minute (7,5 s entre deux).
"""
import base64, difflib, json, re, subprocess, tempfile, time, unicodedata, urllib.request, uuid, os

BASE = "https://sproochmaschinn.lu"
_last = [0.0]


def _pace():
    wait = 7.5 - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.time()


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode())


def session():
    return call("POST", "/api/session")["session_id"]


def _wait(rid, tries=120, step=1.0):
    res = {}
    for _ in range(tries):
        res = call("GET", f"/api/result/{rid}")
        if res.get("status") == "completed":
            break
        time.sleep(step)
    return res


def tts_mp3(sid, text, voice, out_path):
    """Synthétise `text` avec la voix `voice` ('maxine' ou 'claude') et écrit un mp3 mono 64 kb/s."""
    _pace()
    rid = call("POST", f"/api/tts/{sid}", {"text": text, "model": voice})["request_id"]
    res = _wait(rid, 90)
    wav = base64.b64decode(res["result"]["data"])
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(wav)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-ac", "1", "-b:a", "64k", out_path], check=True)
    os.unlink(tmp.name)
    return res["result"].get("duration", 0)


def stt_text(sid, file_path):
    """Transcrit un fichier audio (luxembourgeois)."""
    boundary = uuid.uuid4().hex
    content = open(file_path, "rb").read()
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{n}"\r\n\r\n{v}\r\n'.encode()
             for n, v in (("enable_speaker_identification", "false"), ("language", "lb"))]
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="audio"; filename="clip.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode() + content + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    _pace()
    req = urllib.request.Request(BASE + f"/api/stt/{sid}", data=b"".join(parts), method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        rid = json.loads(r.read().decode())["request_id"]
    res = _wait(rid, 120, 1.5)
    return (res.get("result") or {}).get("text") or ""


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", "", s).split()


def similarity(a, b):
    return difflib.SequenceMatcher(None, " ".join(norm(a)), " ".join(norm(b))).ratio()
