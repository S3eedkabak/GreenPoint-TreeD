# Tree-D Quick Start Guide

## 🚀 FASTEST Way to Start (RECOMMENDED)

```bash
cd /Users/saeedkabak/Documents/GitHub/Green-Point-3rd-Year-Final-Project-TreeD

# One command to start everything!
./start-dev.sh
```

**What happens:**
1. ✅ Backend starts in Docker (database + API)
2. ✅ Expo starts locally (shows QR code!)
3. ✅ Scan QR code with Expo Go
4. ✅ App works with cloud sync!

---

## 📱 Alternative: Offline-Only Mode

```bash
# Skip backend completely
npx expo start --tunnel
```

Backend not needed! App works 100% offline with local SQLite database.

---

## 🛠️ Manual Setup (Advanced)

**Terminal 1 - Backend:**
```bash
docker-compose -f docker-compose.backend.yml up
```

**Terminal 2 - Mobile App:**
```bash
npx expo start --tunnel
```

---

## 🔍 Verify Everything Works

```bash
# Check backend health
curl http://localhost:3000/health

# Check database
docker exec -it treed-postgres psql -U treed_user -d treed_db -c "SELECT * FROM trees;"

# View API logs
docker-compose -f docker-compose.backend.yml logs api-gateway

# View database logs
docker-compose -f docker-compose.backend.yml logs postgres
```

---

## 🛑 Stop Everything

```bash
# Stop backend
docker-compose -f docker-compose.backend.yml down

# Stop Expo (Ctrl+C in terminal)
```

---

## 🐛 Troubleshooting

**QR code doesn't appear:**
- ✅ Make sure you're running Expo LOCALLY (not in Docker)
- ✅ Run `npx expo start --tunnel`

**Can't connect from phone:**
- ✅ Make sure phone is on same WiFi
- ✅ Try `--tunnel` mode: `npx expo start --tunnel`

**Backend won't start:**
```bash
# Clean Docker
docker-compose -f docker-compose.backend.yml down -v
docker system prune -a

# Rebuild
docker-compose -f docker-compose.backend.yml up --build
```

---

**Made with 🌲 by the Tree-D Team**
