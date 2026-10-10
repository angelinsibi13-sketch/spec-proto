"use client";

import { useState } from "react";
import { PageTitle, Screen, Surface } from "@/components/bits";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PRIORITY_LABEL, TYPE_INFO } from "@/lib/catalog";
import { useFix } from "@/lib/store";
import type { Priority } from "@/lib/types";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: PRIORITY_LABEL.high },
  { value: "medium", label: PRIORITY_LABEL.medium },
  { value: "low", label: PRIORITY_LABEL.low },
];

export function SettingsScreen() {
  const { vault, patchRule, wipe } = useFix();
  const [open, setOpen] = useState(false);
  if (!vault) return null;

  return (
    <Screen>
      <PageTitle
        eyebrow="Гибкость"
        title="Правила, шаблоны, приоритеты"
        text="Выключите тип или поменяйте слова — следующий звонок сразу это подхватит."
      />

      <div className="space-y-3">
        {vault.rules.map((rule) => (
          <Surface key={rule.type}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{TYPE_INFO[rule.type].description}</p>
                <p className="text-xs text-[#626c77]">Подсказка: {TYPE_INFO[rule.type].hint}</p>
              </div>
              <Switch
                checked={rule.enabled}
                onCheckedChange={(enabled) => patchRule(rule.type, { enabled })}
                aria-label={`Правило ${TYPE_INFO[rule.type].label}`}
              />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor={`kw-${rule.type}`}>Слова через запятую</Label>
                <Input
                  id={`kw-${rule.type}`}
                  className="mt-1.5 h-10"
                  value={rule.keywords}
                  onChange={(event) => patchRule(rule.type, { keywords: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`tpl-${rule.type}`}>Шаблон задачи</Label>
                <Input
                  id={`tpl-${rule.type}`}
                  className="mt-1.5 h-10"
                  value={rule.template.replaceAll("{client}", "").replace(/\s*—\s*$/, "").trim()}
                  onChange={(event) => patchRule(rule.type, { template: event.target.value })}
                />
              </div>
            </div>
            <div className="mt-3">
              <Label>Приоритет</Label>
              <Select
                items={PRIORITIES}
                value={rule.priority}
                onValueChange={(value) => {
                  if (value === "high" || value === "medium" || value === "low") {
                    patchRule(rule.type, { priority: value });
                  }
                }}
              >
                <SelectTrigger className="mt-1.5 w-full max-w-xs" aria-label="Приоритет">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Surface>
        ))}
      </div>

      <Button variant="destructive" className="mt-4 h-10" onClick={() => setOpen(true)}>
        Сбросить прототип
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сбросить хранилище на сервере?</DialogTitle>
            <DialogDescription>
              Удалятся согласие, звонки, задачи и журнал. Файл шифрования создастся заново. Это только прототип.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Оставить
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setOpen(false);
                wipe();
              }}
            >
              Сбросить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
