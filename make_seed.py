"""產生初始帳號：seed_users.json（只有雜湊，要部署）＋ 初始帳密.txt（明文，只留本機、不部署、登入後請改掉）。"""
import json, secrets, hashlib, os

def mk(pw):
    salt = secrets.token_hex(16); it = 200000
    return {"salt": salt, "hash": hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), it).hex(), "iters": it}

kid_pw = "".join(secrets.choice("23456789") for _ in range(6))
parent_pw = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(10))
seed = {
    "學員": {"display": "學員", "role": "learner", **mk(kid_pw)},
    "家長": {"display": "家長", "role": "parent", **mk(parent_pw)},
}
def write_secret(path, text):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)

write_secret("seed_users.json", json.dumps(seed, ensure_ascii=False, indent=1))
write_secret(
    "初始帳密.txt",
    f"VEX IQ 自學網站 初始帳號（登入後請自己改密碼，改完可刪掉這個檔案）\n\n學員  名字：學員  密碼：{kid_pw}\n家長  名字：家長  密碼：{parent_pw}\n",
)
print("done")
