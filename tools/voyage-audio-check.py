#!/usr/bin/env python3
"""Contrôle automatique du son de « Mon voyage » : transcrit chaque clip (reconnaissance vocale de la Sproochmaschinn) et
le compare au texte prévu. Un écart ne prouve pas une mauvaise prononciation, mais signale les clips à écouter.

Usage : python3 tools/voyage-audio-check.py tools/voyage-audio.json [id ...]
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sproochmaschinn as sm

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main(manifest_path, only):
    manifest = json.load(open(manifest_path, encoding="utf-8"))
    sid = sm.session()
    for clip in manifest["clips"]:
        if only and clip["id"] not in only:
            continue
        f = os.path.join(ROOT, "assets", "audio", "voyage", manifest["unit"], clip["id"] + ".mp3")
        if not os.path.exists(f):
            print("absent", clip["id"])
            continue
        heard = sm.stt_text(sid, f)
        score = sm.similarity(heard, clip["text"])
        print(("ok    " if score >= 0.9 else "ÉCART "), clip["id"].ljust(14), f"{score:.2f}", "| prévu :", clip["text"], "| entendu :", heard, flush=True)


if __name__ == "__main__":
    main(sys.argv[1], set(sys.argv[2:]))
