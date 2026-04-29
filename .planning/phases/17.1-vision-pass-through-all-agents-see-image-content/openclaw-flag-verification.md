# OpenClaw CLI Image Flag Verification

**Verified:** 2026-04-29
**Outcome:** D — None of `--image`, `--attachment`, `--media`, or inline data-URI / base64 input are supported by `openclaw agent`.

## Investigation method

The agents host SSH key (`~/.ssh/lucas_beaglemind`) is configured per `~/.ssh/config` for the `agents` alias (`lucas@46.225.56.122`).

`sudo -u mo openclaw agent --help` was attempted but returned a truncated stub (`Options: -h, --help`) because OpenClaw short-circuits the help renderer when it cannot read `~/.openclaw/openclaw.json`. On the agents host that file is owned by `root:root` with mode `600`, so `sudo -u mo` cannot read it — known deployment quirk, unrelated to vision pass-through. The truncation prevented `--help` from being authoritative, so the canonical source-of-truth was found by inspecting the binary's command-registration JS at `/usr/lib/node_modules/openclaw/dist/register.agent-DA0Frq4g.js`.

The root commander program *does* render the agent line in `openclaw --help`:

```
agent                Run one agent turn via the Gateway
...
openclaw agent --to +15555550123 --message "Run summary" --deliver
  Talk directly to the agent using the Gateway; optionally send the WhatsApp reply.
```

— but that example shows no image / attachment flag, which the source confirms is exhaustive.

## --help output (relevant lines)

Extracted directly from `/usr/lib/node_modules/openclaw/dist/register.agent-DA0Frq4g.js`:

```js
program.command("agent")
  .description("Run an agent turn via the Gateway (use --local for embedded)")
  .requiredOption("-m, --message <text>", "Message body for the agent")
  .option("-t, --to <number>", "Recipient number in E.164 used to derive the session key")
  .option("--session-id <id>", "Use an explicit session id")
  .option("--agent <id>", "Agent id (overrides routing bindings)")
  .option("--thinking <level>", "Thinking level: off | minimal | low | medium | high | xhigh")
  .option("--verbose <on|off>", "Persist agent verbose level for the session")
  .option("--channel <channel>", `Delivery channel: ${args.agentChannelOptions} (omit to use the main session channel)`)
  .option("--reply-to <target>", "Delivery target override (separate from session routing)")
  .option("--reply-channel <channel>", "Delivery channel override (separate from routing)")
  .option("--reply-account <id>", "Delivery account id override")
  .option("--local", "Run the embedded agent locally (requires model provider API keys in your shell)", false)
  .option("--deliver", "Send the agent's reply back to the selected channel", false)
  .option("--json", "Output result as JSON", false)
  .option("--timeout <seconds>", "Override agent command timeout (seconds, default 600 or config value)")
  .addHelpText("after", ...)
```

## Confirmation: no image flag in any form

Direct grep of the agent register file:

```
$ sudo grep -cE "image|attachment" /usr/lib/node_modules/openclaw/dist/register.agent-DA0Frq4g.js
0
```

```
$ sudo grep -E "data:image|base64.*image|messageBodyParse" /usr/lib/node_modules/openclaw/dist/register.agent-DA0Frq4g.js
(no matches)
```

Other openclaw subcommands (`message broadcast`, `events create`, `emoji upload`, etc.) do support `--media`, `--image`, `--attachment` flags — but the *agent turn* command (the only command the console-hub bridge invokes) is text-only.

## Verified flag

**None.** No file flag, no URL flag, no inline data-URI support on `openclaw agent`.

## Temp-file strategy

Not applicable for outcome D — no flag exists to consume the temp file. Skipping the dry-run step.

## Dry-run output

Not applicable — there is nothing to invoke.

## Implementation guidance for Task 3

Per the plan's outcome-D branch:

1. **Widen `sendToAgent` signature for forward-compatibility** so future Track-3 work can wire bytes if/when OpenClaw ships a vision flag without re-touching every caller. Signature change only — no behavior change to the SSH command shape.

2. **When `imageAttachments` arrives**, log a single `warn` line per call:
   ```ts
   if (imageAttachments && imageAttachments.length > 0) {
     log.warn(
       { agentId: cfg.agentId, imageCount: imageAttachments.length },
       'imageAttachments received but OpenClaw CLI does not support image input — dropping bytes (description-only path)',
     );
   }
   ```
   Then continue to the existing text-only invocation unchanged.

3. **Do NOT write temp files, do NOT add a finally cleanup block** — there's nothing to clean up.

4. **Preserve the `VISION_CAPABLE` gate in `routes.ts`** anyway (per the plan's explicit guidance for outcome D) so when OpenClaw eventually ships vision support, only the bridge body needs a one-file change to flip from "drop bytes" to "forward bytes." Mo and Jarvis will already be marked vision-capable; the gate is the seam.

5. **UAT-17-1-02 implication:** Mo and Jarvis cannot reference pixel-level details that go beyond the description in this phase. Plan 17.1-04 (deploy + UAT) must waive UAT-17-1-02 with a reference to this verification artifact. The description floor (UAT-17-1-01 + UAT-17-1-03) still ships — every agent sees the vision-API description from Plan 17.1-01.

## Future-fix path

When OpenClaw ships an image flag (likely `--image <path>` based on the broader codebase convention in `register.message-BsA8lLFf.js`), the change required is:

- Replace the `log.warn` block in `openclaw-cli-bridge.ts` with the temp-file write + flag-append pattern documented in `17.1-PATTERNS.md` lines 396-468 (outcome-A branch).
- Mark UAT-17-1-02 verifiable in the next deploy.

No web-side, hub-Zod, or `VISION_CAPABLE`-gate changes required at that time — they're already in place after this plan.
