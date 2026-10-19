# DevBlueprint

DevBlueprint คือเว็บแอปสำหรับวางแผนโปรเจกต์ซอฟต์แวร์จากเอกสาร โดยรวมข้อมูลโปรเจกต์ เอกสาร โครงสร้างไฟล์ Checklist ความคืบหน้า ปฏิทินกิจกรรม และ AI Analysis ไว้ใน Workspace เดียว

ระบบเหมาะสำหรับทีมที่ต้องการ:

- สร้างและจัดการหลายโปรเจกต์
- อัปโหลดเอกสาร requirement หรือ technical specification
- สกัดโครงสร้างโปรเจกต์จาก File Tree ในเอกสารโดยรักษาข้อมูลต้นฉบับ
- สร้าง Checklist แบบแบ่ง Phase, area, priority และรายละเอียด
- ติดตามสถานะงาน `ยังไม่เริ่ม`, `กำลังทำ` และ `เสร็จแล้ว`
- วิเคราะห์เอกสารด้วย Google Gemini
- จัดการสมาชิกและสิทธิ์ใน Workspace
- ดูกิจกรรมของโปรเจกต์ผ่านปฏิทินแบบ GitHub-inspired
- เขียนโน้ตแยกตามโปรเจกต์

## เทคโนโลยี

- Next.js 16.4.2 และ React 19
- TypeScript
- Prisma 6 และ PostgreSQL 16
- NextAuth 5 สำหรับ Authentication
- Zod สำหรับตรวจสอบข้อมูล
- Google Gemini สำหรับ AI Analysis
- pnpm 12

## ความต้องการก่อนเริ่ม

- Node.js 20 ขึ้นไป
- pnpm 12
- Docker Desktop (สำหรับ PostgreSQL ในเครื่อง)
- Google AI Studio API key (เฉพาะกรณีใช้ AI Analysis)

ตรวจสอบเวอร์ชัน:

```powershell
node --version
pnpm --version
docker --version
```

## เริ่มใช้งานในเครื่อง

1. ติดตั้ง dependencies:

```powershell
pnpm install
```

2. สร้างไฟล์ environment:

```powershell
Copy-Item .env.example .env
```

3. เปิด PostgreSQL และบริการพัฒนาอื่น ๆ:

```powershell
docker compose up -d
```

4. สร้างตารางฐานข้อมูล:

```powershell
pnpm prisma migrate dev
pnpm prisma generate
```

5. เริ่มเว็บ:

```powershell
pnpm dev
```

เปิด [http://localhost:3000](http://localhost:3000)

ตรวจสุขภาพระบบได้ที่ [http://localhost:3000/api/health](http://localhost:3000/api/health)

หยุดบริการ Docker:

```powershell
docker compose down
```

## Environment variables

ไฟล์ `.env.example` เป็นตัวอย่างสำหรับการพัฒนา ห้ามใส่ secret จริงลง Git และห้ามส่ง API key ในแชต

ค่าหลักที่ต้องตั้ง:

| ตัวแปร | ใช้ทำอะไร | Development | Production |
| --- | --- | --- | --- |
| `APP_URL` | URL หลักของระบบ | `http://localhost:3000` | URL เว็บจริง เช่น `https://app.example.com` |
| `DATABASE_URL` | Connection string ของ PostgreSQL | PostgreSQL จาก Docker | PostgreSQL ที่เปิดให้บริการออนไลน์ |
| `AUTH_SECRET` | Secret สำหรับ session | ค่าสำหรับเครื่องตัวเอง | สุ่มใหม่อย่างน้อย 32 ตัวอักษร |
| `AUTH_TRUST_HOST` | ให้ Auth ทำงานหลัง proxy | `true` | `true` |
| `S3_ENDPOINT` | ค่า storage ที่ schema ต้องการ | `http://localhost:9000` | endpoint ของ storage จริง |
| `S3_BUCKET` | ชื่อ bucket | `devblueprint` | bucket ที่สร้างไว้ |
| `S3_ACCESS_KEY` | access key ของ storage | ค่าจาก MinIO | secret ของ storage จริง |
| `S3_SECRET_KEY` | secret key ของ storage | ค่าจาก MinIO | secret ของ storage จริง |
| `AI_DEFAULT_PROVIDER` | provider ของ AI | `gemini` | `gemini` |
| `GEMINI_API_KEY` | API key สำหรับวิเคราะห์เอกสาร | ใส่จาก Google AI Studio | ใส่เป็น secret ของ hosting |
| `MAX_UPLOAD_MB` | ขนาดไฟล์สูงสุด | `20` | `20` หรือตามนโยบายระบบ |

ระบบล็อกโมเดล AI เป็น `gemini-3.8-flash` จึงไม่ต้องตั้ง `GEMINI_MODEL`

## ฟีเจอร์หลัก

### Authentication และ Workspace

- สมัครสมาชิกและเข้าสู่ระบบ
- สร้าง Workspace แรกอัตโนมัติหลังสมัคร
- ตรวจ session และ membership ใน API
- จัดการชื่อผู้ใช้ ภาษา และชื่อ Workspace
- เพิ่มสมาชิกจากผู้ใช้ที่มีบัญชีแล้ว
- เปลี่ยน role เป็น `OWNER`, `ADMIN`, `EDITOR` หรือ `VIEWER`
- ป้องกันการแก้ไขหรือลบ OWNER

### Project และ Checklist

- สร้าง แก้ไข ลบ และติดดาวโปรเจกต์
- เรียงโปรเจกต์ตามแก้ไขล่าสุด สร้างล่าสุด ชื่อ หรือรายการติดดาว
- เพิ่มและแก้ไข Checklist ด้วยตนเอง
- เปลี่ยนสถานะ Checklist ได้จากหน้า Dashboard
- แสดงความคืบหน้าเป็นเปอร์เซ็นต์
- แสดงรายการตาม Phase และกรองตามสถานะ
- ส่งออกข้อมูลเป็น Markdown หรือ JSON

### Document Management

รองรับไฟล์:

- `.md`
- `.txt`
- `.json`
- `.yaml`
- `.yml`

ข้อจำกัด:

- ไฟล์ต้องไม่ว่าง
- ขนาดไม่เกิน `MAX_UPLOAD_MB` (ค่าเริ่มต้น 20 MB)
- JSON ที่ syntax ไม่ถูกต้องจะถูกปฏิเสธ

เอกสารจะถูก parse และแบ่งเป็น chunks เพื่อเตรียมใช้กับ AI โดยข้อมูล MVP ถูกเก็บใน PostgreSQL

> สำหรับระบบ production ที่มีเอกสารจำนวนมาก ควรย้ายเนื้อหาไฟล์ไป object storage จริง เช่น S3, Cloudflare R2 หรือบริการที่รองรับ S3 API

### AI Analysis

ผู้ใช้ที่มี role `OWNER`, `ADMIN` หรือ `EDITOR` สามารถเริ่มวิเคราะห์เอกสารได้ ผลลัพธ์ประกอบด้วย:

- สรุปว่าเอกสารเกี่ยวกับอะไร
- เทคโนโลยี ภาษา Framework และเครื่องมือ
- โครงสร้างโปรเจกต์จาก File Tree ที่พบในเอกสาร
- ประเด็นหรือความเสี่ยงที่ควรตรวจสอบ
- Checklist แบบละเอียดตาม Phase
- Readiness score 0-100

เมื่อเอกสารมี File Tree ระบบจะใช้โครงสร้างจากเอกสารเป็นหลัก ไม่สร้างโครงสร้างจำลองแทน และรักษาชื่อไฟล์ ลำดับ และ root ตามหลักฐานที่พบ

การวิเคราะห์แต่ละครั้งถูกบันทึกเป็น `AnalysisRun` พร้อมสถานะ:

- `PROCESSING`
- `COMPLETED`
- `FAILED`

ถ้าไม่มี `GEMINI_API_KEY` ระบบจะแจ้งข้อผิดพลาดและไม่สร้างผลวิเคราะห์ปลอม

### Calendar และ Notes

- สีขาว: ไม่มี activity
- สีเขียวอ่อน: สร้างโปรเจกต์หรืออัปโหลดเอกสารในวันนั้น
- สีเขียวเข้ม: มีโปรเจกต์เสร็จ 100% ในวันนั้น
- ขยายปฏิทินเพื่อดูรายละเอียดและเลือกโปรเจกต์
- เปิดแผง `โน้ต` จากด้านบนของ Dashboard
- โน้ตถูกแยกตามโปรเจกต์และบันทึกใน browser ของผู้ใช้

## API หลัก

ทุก endpoint ที่เกี่ยวกับข้อมูลต้องมี session และตรวจ Workspace membership

| Method | Endpoint | สิทธิ์ |
| --- | --- | --- |
| `POST` | `/api/auth/register` | สาธารณะ |
| `GET` | `/api/projects` | สมาชิก Workspace |
| `POST` | `/api/projects` | OWNER / ADMIN / EDITOR |
| `PATCH` | `/api/projects/:projectId` | OWNER / ADMIN / EDITOR |
| `DELETE` | `/api/projects/:projectId` | OWNER / ADMIN / EDITOR |
| `GET` | `/api/projects/:projectId/documents` | สมาชิก Workspace |
| `POST` | `/api/projects/:projectId/documents` | OWNER / ADMIN / EDITOR |
| `DELETE` | `/api/projects/:projectId/documents/:documentId` | OWNER / ADMIN / EDITOR |
| `GET` | `/api/projects/:projectId/analysis` | สมาชิก Workspace |
| `POST` | `/api/projects/:projectId/analysis` | OWNER / ADMIN / EDITOR |
| `POST` | `/api/projects/:projectId/items` | OWNER / ADMIN / EDITOR |
| `PATCH` | `/api/projects/:projectId/items/:itemId` | OWNER / ADMIN / EDITOR |
| `GET/PATCH` | `/api/settings` | ผู้ใช้ที่ login แล้ว |
| `GET/POST` | `/api/settings/members` | OWNER / ADMIN |

## นำขึ้นออนไลน์ด้วย Vercel + Neon

ชุดที่แนะนำสำหรับโปรเจกต์นี้คือ:

- **Vercel** สำหรับ Next.js และ API routes
- **Neon** สำหรับ PostgreSQL
- **Google AI Studio** สำหรับ Gemini API
- S3-compatible storage สำหรับไฟล์ในอนาคต (MVP ปัจจุบันยังเก็บข้อมูลเอกสารใน PostgreSQL)

### 1. เตรียม Repository

Push โปรเจกต์ขึ้น GitHub โดยตรวจให้แน่ใจก่อนว่า `.env` อยู่ใน `.gitignore`:

```powershell
git status
git add .
git commit -m "Prepare DevBlueprint for deployment"
git push
```

ห้ามใช้ `git add .env` และห้าม commit API key

### 2. สร้างฐานข้อมูล Neon

1. สร้าง project ใหม่ใน Neon
2. คัดลอก connection string จากเมนู **Connect**
3. เลือก connection string ที่มี SSL และเหมาะกับ serverless เช่น pooled connection
4. เก็บค่าไว้เป็น `DATABASE_URL` ใน Vercel เท่านั้น

ไม่ควรใช้ connection string ของ PostgreSQL จาก `docker-compose.yml` เป็น production

### 3. สร้างโปรเจกต์ Vercel

1. เปิด Vercel แล้วเลือก **Add New Project**
2. Import GitHub repository ของ DevBlueprint
3. ใช้ค่า build เริ่มต้นของ Next.js
4. ตั้งค่า Environment Variables ตามตารางด้านบน:

```dotenv
NODE_ENV=production
APP_URL=https://ชื่อโปรเจกต์ของคุณ.vercel.app
DATABASE_URL=ใส่-connection-string-จาก-Neon
AUTH_SECRET=สุ่มค่าใหม่อย่างน้อย-32-ตัวอักษร
AUTH_TRUST_HOST=true
S3_ENDPOINT=https://storage-provider.example.com
S3_REGION=us-east-1
S3_BUCKET=devblueprint
S3_ACCESS_KEY=ใส่เป็น-Vercel-environment-secret
S3_SECRET_KEY=ใส่เป็น-Vercel-environment-secret
AI_DEFAULT_PROVIDER=gemini
GEMINI_API_KEY=ใส่เป็น-Vercel-environment-secret
MAX_UPLOAD_MB=20
```

ตั้งค่าตัวแปรอย่างน้อยใน environment `Production` และ `Preview` ตามที่ต้องการ แล้วกด **Deploy**

### 4. Run database migration

หลังสร้าง Vercel project แล้ว ให้รัน migration กับ Neon โดยใช้ `DATABASE_URL` ของ Neon:

```powershell
pnpm prisma migrate deploy
```

บน Windows สามารถใช้ PowerShell ชั่วคราวได้:

```powershell
$env:DATABASE_URL="connection-string-จาก-Neon"
pnpm prisma migrate deploy
pnpm prisma generate
Remove-Item Env:DATABASE_URL
```

หรือรันจากเครื่อง CI/CD ที่เก็บ `DATABASE_URL` เป็น secret

9. ทดสอบ:

- เปิดหน้าเว็บ
- สมัครสมาชิกใหม่
- สร้างโปรเจกต์
- อัปโหลดเอกสาร
- ตรวจ `/api/health`
- ทดลอง AI Analysis หลังตั้ง `GEMINI_API_KEY`

ถ้าเปิดเว็บได้แต่ login ไม่ผ่าน ให้ตรวจ `APP_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST` และ domain ที่เปิดอยู่ใน Vercel ก่อน

### ค่าที่ต้องระวังตอน Production

- ห้ามใช้ `AUTH_SECRET=changeme_in_production_32_chars_min`
- ห้ามใช้ database จาก Docker ในเครื่องเป็นฐานข้อมูลจริง
- ห้ามใส่ `.env` ใน GitHub
- ต้องตั้ง callback/allowed URL ของ provider ให้ตรงกับโดเมนจริง หากมีการเพิ่ม OAuth ในอนาคต
- ควรจำกัดสิทธิ์และ quota ของ Gemini API key
- ควรตั้ง backup และ connection pooling ให้ PostgreSQL
- ไฟล์ที่อัปโหลดในปัจจุบันยังถูกเก็บในฐานข้อมูลสำหรับ MVP

## คำสั่งตรวจสอบก่อน Deploy

```powershell
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

## Prisma และ Migration

เมื่อแก้ `prisma/schema.prisma` ใน development:

```powershell
pnpm prisma migrate dev --name <migration-name>
pnpm prisma generate
```

เมื่อ deploy production:

```powershell
pnpm prisma migrate deploy
pnpm prisma generate
```

เปิด Prisma Studio:

```powershell
pnpm prisma studio
```

## โครงสร้างโฟลเดอร์สำคัญ

```text
src/
├── app/
│   ├── api/                 # API routes
│   ├── login/              # หน้าเข้าสู่ระบบ
│   ├── register/           # หน้าสมัครสมาชิก
│   ├── settings/           # ตั้งค่า Workspace และผู้ใช้
│   ├── globals.css         # สไตล์หลัก
│   └── page.tsx            # Dashboard
├── components/auth/        # ฟอร์ม Auth และ Logout
├── config/                 # ตรวจสอบ environment
└── server/
    ├── ai/                 # Gemini integration
    ├── auth.ts             # NextAuth
    └── db.ts               # Prisma client

prisma/
├── schema.prisma
└── migrations/
```

## สถานะปัจจุบันและงานต่อยอด

ระบบพร้อมใช้เป็น MVP และ deploy เพื่อทดสอบกับผู้ใช้จริงได้แล้ว งานที่ควรทำต่อเมื่อเริ่มใช้งานจริง:

1. ย้ายไฟล์เอกสารไป object storage
2. เพิ่ม background job สำหรับ AI Analysis และไฟล์ขนาดใหญ่
3. เพิ่ม automated tests สำหรับ parser, Calendar และ AI response
4. เพิ่ม rate limit และ audit log
5. เพิ่มระบบเชิญสมาชิกผ่าน email จริง
6. เพิ่ม monitoring, error tracking และ database backup
