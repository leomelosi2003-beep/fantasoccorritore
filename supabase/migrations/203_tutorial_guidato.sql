-- 203 (12/11/2026): tutorial guidato passo passo (web/components/TutorialCoach.tsx).
alter table public.organizations add column if not exists tutorial_step int not null default 0;
alter table public.organizations add column if not exists tutorial_done boolean not null default false;
-- all'attivazione: tutorial_done = true per chi aveva già >= 3 mezzi (gli altri lo vedono partire da solo)
-- my_tutorial_state(): {step, done, vehicles, cards, drivers, dispatched, completed, first_reward}
-- tutorial_set(step, done): salva il passo (il menu "Tutorial" fa tutorial_set(0,false))
-- (corpi completi applicati via MCP)
