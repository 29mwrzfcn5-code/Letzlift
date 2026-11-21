#!/usr/bin/env python3
"""Génère le son des unités de « Mon voyage » avec la Sproochmaschinn (voix Maxine et Claude, usage non commercial).

Usage : python3 tools/voyage-audio.py tools/voyage-audio.json [--verify] [id ...]
Écrit assets/audio/voyage/<unité>/<id>.mp3 (mono, 64 kb/s). Un clip déjà présent n'est pas régénéré (supprimer le fichier).
--verify : après chaque synthèse, transcrit le clip avec la reconnaissance vocale de la Sproochmaschinn et le compare au texte ;
           si l'écart est net, nouvelle tentative (jusqu'à 4 par défaut, VOYAGE_TRIES=8 pour insister, la synthèse varie d'un essai à l'autre) et on garde le meilleur.
           Ce contrôle ne remplace pas l'écoute : la transcription peut aussi se tromper.
Conditions : https://sproochmaschinn.lu (API non commerciale). Voix « max » interdite ici.
"""
import json, os, shutil, sys, tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sproochmaschinn as sm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GOOD = float(os.environ.get('VOYAGE_GOOD', '0.9'))      # similarité à partir de laquelle on s'arrête (VOYAGE_GOOD=0.99 pour exiger une transcription exacte)
TRIES = int(os.environ.get('VOYAGE_TRIES', '4'))


def main(manifest_path, verify, only):
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    out_dir = os.path.join(ROOT, "assets", "audio", "voyage", manifest["unit"])
    os.makedirs(out_dir, exist_ok=True)
    sid = sm.session()
    done = {}
    for clip in manifest["clips"]:
        if clip["voice"] == "max":
            raise SystemExit("La voix « max » n'est pas autorisée ici.")
        if only and clip["id"] not in only:
            continue
        target = os.path.join(out_dir, clip["id"] + ".mp3")
        key = (clip["voice"], clip["text"])
        if os.path.exists(target):
            continue
        if key in done:
            shutil.copyfile(done[key], target)
            print("copie", clip["id"])
            continue
        best, best_score, best_heard = None, -1, ""
        for attempt in range(1, (TRIES if verify else 1) + 1):
            tmp = tempfile.mktemp(suffix=".mp3")
            sm.tts_mp3(sid, clip["text"], clip["voice"], tmp)
            if not verify:
                best, best_score = tmp, 1
                break
            heard = sm.stt_text(sid, tmp)
            score = sm.similarity(heard, clip["text"])
            print(f"  {clip['id']} essai {attempt} : {score:.2f} | entendu : {heard}", flush=True)
            if score > best_score:
                if best and os.path.exists(best):
                    os.unlink(best)
                best, best_score, best_heard = tmp, score, heard
            else:
                os.unlink(tmp)
            if best_score >= GOOD:
                break
        shutil.move(best, target)
        done[key] = target
        flag = "" if best_score >= GOOD else "  ← À ÉCOUTER"
        print("ok", clip["id"], clip["voice"], f"(similarité {best_score:.2f})" if verify else "", flag, flush=True)


if __name__ == "__main__":
    args = sys.argv[2:]
    main(sys.argv[1], "--verify" in args, {a for a in args if not a.startswith("--")})
