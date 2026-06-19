// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Hamza Ghandouri <hamza.ghandouri@gmail.com> - https://miqraa.org

use anyhow::Result;
use clap::{Parser, Subcommand};
use uuid::Uuid;

use maqraa::api::router::build_router;
use maqraa::auth::password::hash_password;
use maqraa::config::AppConfig;
use maqraa::db::create_pool;
use maqraa::{build_app_state, init_tracing, run_migrations, serve, spawn_background_tasks};

#[derive(Parser)]
#[command(name = "maqraa-backend")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Create an admin user (bootstrap when no admin exists yet)
    CreateAdmin {
        #[arg(long)]
        name: String,
        #[arg(long)]
        email: String,
        #[arg(long)]
        password: String,
    },
}

async fn create_admin(name: String, email: String, password: String) -> Result<()> {
    init_tracing()?;

    let config = AppConfig::load()?;
    let pool = create_pool(&config.database_url).await?;
    run_migrations(&pool).await?;

    let email_norm = email.trim().to_lowercase();
    let existing: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM users WHERE lower(trim(email)) = $1")
            .bind(&email_norm)
            .fetch_optional(&pool)
            .await?;

    if existing.is_some() {
        println!("❌ User with email {email_norm} already exists");
        std::process::exit(1);
    }

    let hash = hash_password(&password)?;
    let id = Uuid::new_v4();

    sqlx::query(
        "INSERT INTO users (id, name, email, password_hash, role) \
         VALUES ($1, $2, $3, $4, 'admin'::user_role)",
    )
    .bind(id)
    .bind(name.trim())
    .bind(&email_norm)
    .bind(&hash)
    .execute(&pool)
    .await?;

    println!("✅ Admin user created: {id}");
    Ok(())
}

async fn run_server() -> Result<()> {
    init_tracing()?;

    tracing::info!("بسم الله الرحمن الرحيم");
    tracing::info!("Starting Al-Maqraa server...");

    let config = AppConfig::load()?;
    tracing::info!(
        notifications_enabled = config.notifications_enabled,
        email_provider = %config.email_provider,
        app_base_url = %config.app_base_url,
        "Loaded configuration"
    );
    tracing::debug!(recordings_path = %config.recordings_path);

    let state = build_app_state(config.clone()).await?;
    spawn_background_tasks(state.clone())?;
    let app = build_router(state);
    serve(app, &config.host, config.port).await
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Some(Commands::CreateAdmin {
            name,
            email,
            password,
        }) => create_admin(name, email, password).await,
        None => run_server().await,
    }
}
