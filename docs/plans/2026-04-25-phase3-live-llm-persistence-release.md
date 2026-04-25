# Phase 3 Live LLM Persistence Release Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 配置真实 DeepSeek API、将 Graph 与 Editor 持久化接入 Neo4j、初始化 git 并发布公开仓库 `Almanack`。

**Architecture:** 在 `packages/shared` 增加 `.env.local` 配置加载能力，在 `agent-service` 中接入 DeepSeek live provider，在 `graph-service` 中增加 Neo4j 读写 API 并由 `api-gateway` 使用。最后初始化 git 仓库、验证通过后发布到 GitHub 当前登录账号的公开仓库。

**Tech Stack:** Node.js、Neo4j Driver、DeepSeek Chat Completions API、git、gh、Homebrew。

---
