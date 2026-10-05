import { unlink, readFile } from "node:fs/promises"
import path from "node:path"
import nextEnv from "@next/env"
import mysql from "mysql2/promise"

nextEnv.loadEnvConfig(process.cwd())

const connectionString = process.env.DATABASE_URL
const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env
if (!connectionString && (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME)) {
  throw new Error("Set DATABASE_URL or DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in .env.local before migrating.")
}

const seedPath = path.join(process.cwd(), "data", "projects.json")
const projects = JSON.parse(await readFile(seedPath, "utf8"))
if (!Array.isArray(projects) || projects.length === 0) {
  throw new Error("The project seed file must contain a non-empty array.")
}
if (projects.some((project) => !project || typeof project.id !== "string" || !project.id)) {
  throw new Error("Every project in the seed file must have a non-empty id.")
}
if (new Set(projects.map((project) => project.id)).size !== projects.length) {
  throw new Error("The project seed file contains duplicate ids.")
}

const pool = mysql.createPool(connectionString || {
  host: DB_HOST,
  port: Number(process.env.DB_PORT ?? "3306"),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? "10"),
  queueLimit: 0,
  connectTimeout: 10_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: "utf8mb4",
})

try {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      project_number INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
      id VARCHAR(100) NOT NULL PRIMARY KEY,
      code VARCHAR(100) NOT NULL UNIQUE,
      title VARCHAR(100) NOT NULL,
      description VARCHAR(500) NOT NULL,
      category ENUM('API', 'Web', 'UI/UX', 'Automation') NOT NULL,
      image_url VARCHAR(500) NOT NULL,
      demo_video VARCHAR(200) NULL,
      technologies JSON NOT NULL,
      role VARCHAR(300) NOT NULL,
      live_demo_url VARCHAR(300) NOT NULL,
      source_code_url VARCHAR(300) NOT NULL,
      price VARCHAR(100) NOT NULL,
      is_published BOOLEAN NOT NULL,
      updated_at VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    for (const project of projects) {
      await connection.execute(
        `INSERT INTO projects (
           id, code, title, description, category, image_url, demo_video, technologies,
           role, live_demo_url, source_code_url, price, is_published, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           description = VALUES(description),
           category = VALUES(category),
           image_url = VALUES(image_url),
           demo_video = VALUES(demo_video),
           technologies = VALUES(technologies),
           role = VALUES(role),
           live_demo_url = VALUES(live_demo_url),
           source_code_url = VALUES(source_code_url),
           price = VALUES(price),
           is_published = VALUES(is_published),
           updated_at = VALUES(updated_at)`,
        [
          project.id,
          project.id,
          project.title,
          project.description,
          project.category,
          project.imageUrl,
          project.demoVideo ?? null,
          JSON.stringify(project.technologies),
          project.role,
          project.liveDemoUrl,
          project.sourceCodeUrl,
          project.price,
          project.isPublished,
          project.updatedAt,
        ],
      )
    }

    const placeholders = projects.map(() => "?").join(", ")
    const [rows] = await connection.execute(
      `SELECT id FROM projects WHERE id IN (${placeholders})`,
      projects.map((project) => project.id),
    )
    if (rows.length !== projects.length) {
      throw new Error("Database verification failed; the seed file was kept.")
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  await unlink(seedPath)
  console.log(`Imported and verified ${projects.length} projects; removed data/projects.json.`)
} finally {
  await pool.end()
}
