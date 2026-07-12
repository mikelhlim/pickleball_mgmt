"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Printer, Send, Sparkles } from "lucide-react";
import { askStatsQuestion, type ChatTurn, type StatsAnswer } from "@/app/(app)/statistics/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Exchange = { question: string; answer: StatsAnswer };

export function StatsChatbot() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isPending, startTransition] = useTransition();

  function ask(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || isPending) return;

    const history: ChatTurn[] = exchanges.flatMap((ex) => [
      { role: "user" as const, content: ex.question },
      { role: "assistant" as const, content: ex.answer.answer },
    ]);

    setOpen(true);
    startTransition(async () => {
      try {
        const answer = await askStatsQuestion(trimmed, history);
        setExchanges((prev) => [...prev, { question: trimmed, answer }]);
        setQuestion("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to ask the assistant.");
      }
    });
  }

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your stats — e.g. “Who has the best win rate at Baldwin Park?”"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={isPending || !question.trim()}>
          <Send className="size-4" />
          Ask
        </Button>
      </form>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Stats Assistant</DialogTitle>
            <DialogDescription>Answers are generated from this app&apos;s data only.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
            {exchanges.map((ex, i) => (
              <div key={i} className="space-y-2">
                <p className="text-sm font-semibold">{ex.question}</p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ex.answer.answer}</p>
                {ex.answer.table && ex.answer.table.rows.length > 0 && (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {ex.answer.table.headers.map((h, hi) => (
                            <TableHead key={hi}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ex.answer.table.rows.map((row, ri) => (
                          <TableRow key={ri}>
                            {row.map((cell, ci) => (
                              <TableCell key={ci}>{cell}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
            {isPending && <p className="text-sm text-muted-foreground">Thinking…</p>}
          </div>

          <div className="flex items-center gap-2 border-t px-6 py-4 print:hidden">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  ask(question);
                }
              }}
              placeholder="Ask a follow-up..."
              disabled={isPending}
            />
            <Button onClick={() => ask(question)} disabled={isPending || !question.trim()} size="icon" aria-label="Ask">
              <Send className="size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              disabled={exchanges.length === 0}
              size="icon"
              aria-label="Save as PDF"
            >
              <Printer className="size-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print-only copy of the thread. The dialog itself can't be printed
          in place — it's `position: fixed` with `overflow-hidden` on an
          85vh-capped ancestor, so anything scrolled past that height gets
          clipped from the PDF. Rendering a plain, unconstrained copy here
          and hiding everything else in @media print (see globals.css)
          guarantees the full thread — including long tables — makes it
          onto the page. */}
      {exchanges.length > 0 && (
        <div id="stats-chat-print" className="hidden print:block">
          <h2>Stats Assistant</h2>
          {exchanges.map((ex, i) => (
            <div key={i}>
              <p>
                <strong>{ex.question}</strong>
              </p>
              <p>{ex.answer.answer}</p>
              {ex.answer.table && ex.answer.table.rows.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      {ex.answer.table.headers.map((h, hi) => (
                        <th key={hi}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ex.answer.table.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
