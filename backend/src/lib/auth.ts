import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

// Sistema de um usuário só: uma senha (APP_PASSWORD) troca por um cookie assinado com HMAC.
// Sem tabela de sessões — o cookie carrega a data de expiração e a assinatura.

const COOKIE = "orbita_sessao";
const DURACAO_MS = 30 * 24 * 60 * 60 * 1000;

function assinar(valor: string): string {
  return createHmac("sha256", config.sessionSecret).update(valor).digest("base64url");
}

function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function senhaConfere(senha: string): boolean {
  return iguais(assinar(senha), assinar(config.appPassword));
}

export function criarSessao(res: Response): void {
  const expira = String(Date.now() + DURACAO_MS);
  res.cookie(COOKIE, `${expira}.${assinar(expira)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: DURACAO_MS,
    path: "/",
  });
}

export function encerrarSessao(res: Response): void {
  res.clearCookie(COOKIE, { path: "/" });
}

function lerCookie(req: Request): string | undefined {
  const cabecalho = req.headers.cookie ?? "";
  for (const parte of cabecalho.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome === COOKIE) return decodeURIComponent(resto.join("="));
  }
  return undefined;
}

export function sessaoValida(req: Request): boolean {
  const valor = lerCookie(req);
  if (!valor) return false;
  const [expira, assinatura] = valor.split(".");
  if (!expira || !assinatura || !iguais(assinatura, assinar(expira))) return false;
  return Number(expira) > Date.now();
}

export function exigirSessao(req: Request, res: Response, next: NextFunction): void {
  if (sessaoValida(req)) return next();
  res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
}
