"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CodeBlock as StyledCodeBlock } from "@/components/ui/code-block";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ColorPicker } from "@/components/ui/color-picker";
import { ArrowLeft, ArrowRight, Download, Heart, Settings } from "lucide-react";
import {
  AnimateCursorApiReference,
  AnimateCursorFollowPreview,
  AnimateCursorMinimalPreview,
} from "@/components/animate-ui/docs/animate-cursor-docs";
import { PropsTable, type PropRow } from "@/components/docs/props-table";

type PreviewVariant = {
  id: string;
  name: string;
  description?: string;
  code: string;
  Preview: () => React.ReactNode;
};

type ComponentEntry = {
  id: string;
  name: string;
  description: string;
  code: string;
  previewVariants?: PreviewVariant[];
  Preview: () => React.ReactNode;
  ApiReference?: () => React.ReactNode;
};

function useComponentRegistry() {
  return useMemo<ComponentEntry[]>(() => {
    const entries: ComponentEntry[] = [
      {
        id: "animate-cursor",
        name: "Cursor",
        description: "Animated cursor + optional follow label (Animate UI).",
        code: `'use client'

import { CursorProvider, Cursor } from "@/components/animate-ui/components/animate/cursor"

export function Demo() {
  return (
    <div className="relative overflow-hidden rounded-lg border">
      <div className="p-10">
        <p className="text-sm text-muted-foreground">Move your cursor here.</p>
      </div>

      <CursorProvider className="absolute inset-0">
        <Cursor className="text-foreground" />
      </CursorProvider>
    </div>
  )
}`,
        previewVariants: [
          {
            id: "minimal",
            name: "Minimal",
            description: "Barebones cursor inside a container.",
            code: `import { CursorProvider, Cursor } from "@/components/animate-ui/components/animate/cursor"

export function Example() {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-background min-h-[320px]">
      <div className="p-10">
        <p className="text-sm text-muted-foreground">Move your cursor here.</p>
      </div>
      <CursorProvider className="absolute inset-0">
        <Cursor className="text-foreground" />
      </CursorProvider>
    </div>
  )
}`,
            Preview: function Preview() {
              return <AnimateCursorMinimalPreview />;
            },
          },
          {
            id: "follow",
            name: "Follow Label",
            description: "Cursor with a follow label tooltip.",
            code: `import { CursorProvider, Cursor, CursorFollow } from "@/components/animate-ui/components/animate/cursor"

export function Example() {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-background min-h-[320px]">
      <div className="p-10">
        <p className="text-sm text-muted-foreground">Move your cursor here.</p>
      </div>
      <CursorProvider className="absolute inset-0">
        <Cursor className="text-foreground" />
        <CursorFollow>Cursor Follow</CursorFollow>
      </CursorProvider>
    </div>
  )
}`,
            Preview: function Preview() {
              return <AnimateCursorFollowPreview />;
            },
          },
        ],
        Preview: function Preview() {
          return <AnimateCursorFollowPreview />;
        },
        ApiReference: function ApiReference() {
          return <AnimateCursorApiReference />;
        },
      },
      {
        id: "buttons",
        name: "Button",
        description:
          "Interactive buttons with smooth click animations and multiple style variants.",
        code: `'use client'

import { Button } from "@/components/ui/button"

export function Example() {
  return <Button>Button</Button>
}`,
        previewVariants: [
          {
            id: "wrap",
            name: "Wrap",
            description: "Buttons in a wrapping row.",
            code: `<div className="flex flex-wrap gap-2">
  <Button>Primary</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="outline">Outline</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="link">Link</Button>
</div>`,
            Preview: function Preview() {
              return (
                <div className="flex flex-wrap gap-2">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                </div>
              );
            },
          },
          {
            id: "toolbar",
            name: "Toolbar",
            description: "Icon-style buttons in a dense toolbar.",
            code: `<div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
  <Button size="icon" variant="outline" aria-label="Like">
    <Heart className="size-4" />
  </Button>
  <Button size="icon" variant="outline" aria-label="Download">
    <Download className="size-4" />
  </Button>
  <Button size="icon" variant="outline" aria-label="Settings">
    <Settings className="size-4" />
  </Button>
  <div className="w-px self-stretch bg-border mx-1" />
  <Button variant="secondary">Share</Button>
</div>`,
            Preview: function Preview() {
              return (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                  <Button size="icon" variant="outline" aria-label="Like">
                    <Heart className="size-4" />
                  </Button>
                  <Button size="icon" variant="outline" aria-label="Download">
                    <Download className="size-4" />
                  </Button>
                  <Button size="icon" variant="outline" aria-label="Settings">
                    <Settings className="size-4" />
                  </Button>
                  <div className="w-px self-stretch bg-border mx-1" />
                  <Button variant="secondary">Share</Button>
                </div>
              );
            },
          },
        ],
        Preview: function Preview() {
          return (
            <div className="flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
          );
        },
        ApiReference: function ApiReference() {
          const rows: PropRow[] = [
            {
              prop: "variant",
              type: `"default" | "destructive" | "outline" | "secondary" | "ghost" | "link"`,
              defaultValue: `"default"`,
              description: "Visual variant from `buttonVariants`.",
            },
            {
              prop: "size",
              type: `"default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"`,
              defaultValue: `"default"`,
              description: "Size variant from `buttonVariants`.",
            },
            {
              prop: "asChild",
              type: "boolean",
              defaultValue: "false",
              description: "Renders a Radix `Slot` instead of a `button`.",
            },
            {
              prop: "...props",
              type: `React.ComponentProps<"button">`,
              defaultValue: "—",
              description: "All standard button props.",
            },
          ];

          return <PropsTable title="Button" rows={rows} />;
        },
      },
      {
        id: "code-block",
        name: "Code Block",
        description:
          "Styled code block with syntax highlighting, copy button, and optional filename header.",
        code: `'use client'

import { CodeBlock } from "@/components/ui/code-block"

export function Example() {
  return <CodeBlock code={\`console.log("Hello")\`} language="tsx" />
}`,
        previewVariants: [
          {
            id: "filename",
            name: "With Filename",
            code: `const sampleCode = \`console.log("Hello")\`

<CodeBlock
  code={sampleCode}
  language="tsx"
  filename="my-component.tsx"
/>`,
            Preview: function Preview() {
              const sampleCode = `'use client'

import * as React from 'react'

type MyComponentProps = {
  myProps: string
} & React.ComponentProps<'div'>

function MyComponent(props: MyComponentProps) {
  return (
    <div {...props}>
      <p>My Component</p>
    </div>
  )
}

export { MyComponent, type MyComponentProps }`;

              return (
                <StyledCodeBlock
                  code={sampleCode}
                  language="tsx"
                  filename="my-component.tsx"
                />
              );
            },
          },
          {
            id: "overlay",
            name: "Overlay Copy",
            description: "No filename (copy button overlays the code).",
            code: `<CodeBlock code={\`console.log("copy me")\`} language="tsx" />`,
            Preview: function Preview() {
              return (
                <StyledCodeBlock
                  code={`console.log("copy me")\n`}
                  language="tsx"
                />
              );
            },
          },
        ],
        Preview: function Preview() {
          const sampleCode = `'use client'

import * as React from 'react'

type MyComponentProps = {
  myProps: string
} & React.ComponentProps<'div'>

function MyComponent(props: MyComponentProps) {
  return (
    <div {...props}>
      <p>My Component</p>
    </div>
  )
}

export { MyComponent, type MyComponentProps }`;

          return (
            <StyledCodeBlock
              code={sampleCode}
              language="tsx"
              filename="my-component.tsx"
            />
          );
        },
        ApiReference: function ApiReference() {
          const rows: PropRow[] = [
            {
              prop: "code",
              type: "string",
              defaultValue: "—",
              description: "Code string to render.",
            },
            {
              prop: "language",
              type: "string",
              defaultValue: `"tsx"`,
              description: "Syntax highlighter language.",
            },
            {
              prop: "filename",
              type: "string",
              defaultValue: "—",
              description: "Optional filename header.",
            },
            {
              prop: "showCopy",
              type: "boolean",
              defaultValue: "true",
              description: "Shows the copy button.",
            },
            {
              prop: "className",
              type: "string",
              defaultValue: "—",
              description: "Wrapper className.",
            },
          ];

          return <PropsTable title="CodeBlock" rows={rows} />;
        },
      },
      {
        id: "dropdown",
        name: "Dropdown Menu",
        description:
          "Action menu with smooth animations, nested submenus, and keyboard shortcut hints.",
        code: `'use client'

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Example() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Item</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}`,
        previewVariants: [
          {
            id: "simple",
            name: "Simple",
            code: `<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-48">
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
            Preview: function Preview() {
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">Open Menu</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            },
          },
          {
            id: "groups",
            name: "With Groups",
            code: `<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Open Menu</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuGroup>
      <DropdownMenuItem>
        Profile
        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        Billing
        <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem>
        Settings
        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Support</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
            Preview: function Preview() {
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">Open Menu</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuGroup>
                      <DropdownMenuItem>
                        Profile
                        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        Billing
                        <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        Settings
                        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Support</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            },
          },
        ],
        Preview: function Preview() {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Open Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    Profile
                    <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Billing
                    <DropdownMenuShortcut>⌘B</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    Settings
                    <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem>Team</DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Share</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem>Email</DropdownMenuItem>
                      <DropdownMenuItem>Message</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>More...</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem>
                    New Team
                    <DropdownMenuShortcut>⌘+T</DropdownMenuShortcut>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem>GitHub</DropdownMenuItem>
                <DropdownMenuItem>Support</DropdownMenuItem>
                <DropdownMenuItem disabled>API</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  Sign Out
                  <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        ApiReference: function ApiReference() {
          const contentRows: PropRow[] = [
            {
              prop: "sideOffset",
              type: "number",
              defaultValue: "4",
              description: "Passed to Radix `DropdownMenuPrimitive.Content`.",
            },
            {
              prop: "className",
              type: "string",
              defaultValue: "—",
              description: "Merged into the default content classes.",
            },
            {
              prop: "...props",
              type: "React.ComponentProps<typeof DropdownMenuPrimitive.Content>",
              defaultValue: "—",
              description: "All Radix content props.",
            },
          ];

          const itemRows: PropRow[] = [
            {
              prop: "inset",
              type: "boolean",
              defaultValue: "—",
              description: "Adds left padding when true.",
            },
            {
              prop: "variant",
              type: `"default" | "destructive"`,
              defaultValue: `"default"`,
              description: "Styles the item via `data-variant`.",
            },
            {
              prop: "...props",
              type: "React.ComponentProps<typeof DropdownMenuPrimitive.Item>",
              defaultValue: "—",
              description: "All Radix item props.",
            },
          ];

          return (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                This file is a thin wrapper around
                `@radix-ui/react-dropdown-menu` primitives.
              </div>
              <PropsTable title="DropdownMenuContent" rows={contentRows} />
              <PropsTable title="DropdownMenuItem" rows={itemRows} />
            </div>
          );
        },
      },
      {
        id: "kbd",
        name: "Kbd",
        description:
          "Keyboard key component for displaying keyboard shortcuts and key combinations.",
        code: `'use client'

import { Kbd, KbdGroup } from "@/components/ui/kbd"

export function Example() {
  return <Kbd>⌘</Kbd>
}`,
        previewVariants: [
          {
            id: "single",
            name: "Single Keys",
            description: "Individual keyboard keys with Mac icons.",
            code: `<div className="flex flex-wrap gap-2">
  <Kbd>⌘</Kbd>
  <Kbd>⇧</Kbd>
  <Kbd>⌥</Kbd>
  <Kbd>⌃</Kbd>
  <Kbd>Enter</Kbd>
  <Kbd>Esc</Kbd>
  <Kbd>Tab</Kbd>
  <Kbd>Space</Kbd>
  <Kbd>A</Kbd>
  <Kbd>K</Kbd>
</div>`,
            Preview: function Preview() {
              return (
                <div className="flex flex-wrap gap-2">
                  <Kbd>⌘</Kbd>
                  <Kbd>⇧</Kbd>
                  <Kbd>⌥</Kbd>
                  <Kbd>⌃</Kbd>
                  <Kbd>Enter</Kbd>
                  <Kbd>Esc</Kbd>
                  <Kbd>Tab</Kbd>
                  <Kbd>Space</Kbd>
                  <Kbd>A</Kbd>
                  <Kbd>K</Kbd>
                </div>
              );
            },
          },
          {
            id: "single-pill",
            name: "Single Pill",
            description: "All keys in one pill with plus signs between.",
            code: `<div className="flex flex-col gap-3">
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground w-32">Copy</span>
    <KbdGroup>
      <span>⌘</span>
      <span className="text-sm opacity-85">+</span>
      <span>C</span>
    </KbdGroup>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground w-32">Paste</span>
    <KbdGroup>
      <span>⌘</span>
      <span className="text-sm opacity-85">+</span>
      <span>V</span>
    </KbdGroup>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground w-32">Save</span>
    <KbdGroup>
      <span>⌘</span>
      <span className="text-sm opacity-85">+</span>
      <span>S</span>
    </KbdGroup>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground w-32">Force Quit</span>
    <KbdGroup>
      <span>⌘</span>
      <span className="text-sm opacity-85">+</span>
      <span>⌥</span>
      <span className="text-sm opacity-85">+</span>
      <span>Esc</span>
    </KbdGroup>
  </div>
</div>`,
            Preview: function Preview() {
              return (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Copy
                    </span>
                    <KbdGroup>
                      <span>⌘</span>
                      <span className="text-sm opacity-85">+</span>
                      <span>C</span>
                    </KbdGroup>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Paste
                    </span>
                    <KbdGroup>
                      <span>⌘</span>
                      <span className="text-sm opacity-85">+</span>
                      <span>V</span>
                    </KbdGroup>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Save
                    </span>
                    <KbdGroup>
                      <span>⌘</span>
                      <span className="text-sm opacity-85">+</span>
                      <span>S</span>
                    </KbdGroup>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Force Quit
                    </span>
                    <KbdGroup>
                      <span>⌘</span>
                      <span className="text-sm opacity-85">+</span>
                      <span>⌥</span>
                      <span className="text-sm opacity-85">+</span>
                      <span>Esc</span>
                    </KbdGroup>
                  </div>
                </div>
              );
            },
          },
          {
            id: "multiple-pills",
            name: "Multiple Pills",
            description: "Separate pills with plus signs between.",
            code: `<div className="flex flex-col gap-3">
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground w-32">Copy</span>
    <div className="inline-flex items-center gap-1">
      <Kbd>⌘</Kbd>
      <span className="text-muted-foreground text-xs">+</span>
      <Kbd>C</Kbd>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground w-32">Paste</span>
    <div className="inline-flex items-center gap-1">
      <Kbd>⌘</Kbd>
      <span className="text-muted-foreground text-xs">+</span>
      <Kbd>V</Kbd>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground w-32">Save</span>
    <div className="inline-flex items-center gap-1">
      <Kbd>⌘</Kbd>
      <span className="text-muted-foreground text-xs">+</span>
      <Kbd>S</Kbd>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground w-32">Force Quit</span>
    <div className="inline-flex items-center gap-1">
      <Kbd>⌘</Kbd>
      <span className="text-muted-foreground text-xs">+</span>
      <Kbd>⌥</Kbd>
      <span className="text-muted-foreground text-xs">+</span>
      <Kbd>Esc</Kbd>
    </div>
  </div>
</div>`,
            Preview: function Preview() {
              return (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Copy
                    </span>
                    <div className="inline-flex items-center gap-1">
                      <Kbd>⌘</Kbd>
                      <span className="text-muted-foreground text-xs">+</span>
                      <Kbd>C</Kbd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Paste
                    </span>
                    <div className="inline-flex items-center gap-1">
                      <Kbd>⌘</Kbd>
                      <span className="text-muted-foreground text-xs">+</span>
                      <Kbd>V</Kbd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Save
                    </span>
                    <div className="inline-flex items-center gap-1">
                      <Kbd>⌘</Kbd>
                      <span className="text-muted-foreground text-xs">+</span>
                      <Kbd>S</Kbd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-32">
                      Force Quit
                    </span>
                    <div className="inline-flex items-center gap-1">
                      <Kbd>⌘</Kbd>
                      <span className="text-muted-foreground text-xs">+</span>
                      <Kbd>⌥</Kbd>
                      <span className="text-muted-foreground text-xs">+</span>
                      <Kbd>Esc</Kbd>
                    </div>
                  </div>
                </div>
              );
            },
          },
        ],
        Preview: function Preview() {
          return (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap gap-2">
                <Kbd>⌘</Kbd>
                <Kbd>⇧</Kbd>
                <Kbd>⌥</Kbd>
                <Kbd>⌃</Kbd>
                <Kbd>A</Kbd>
                <Kbd>K</Kbd>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-32">
                    Single Pill
                  </span>
                  <KbdGroup>
                    <span>⌘</span>
                    <span className="text-sm opacity-85">+</span>
                    <span>K</span>
                  </KbdGroup>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-32">
                    Multiple Pills
                  </span>
                  <div className="inline-flex items-center gap-1">
                    <Kbd>⌘</Kbd>
                    <span className="text-muted-foreground text-xs">+</span>
                    <Kbd>K</Kbd>
                  </div>
                </div>
              </div>
            </div>
          );
        },
        ApiReference: function ApiReference() {
          const kbdRows: PropRow[] = [
            {
              prop: "children",
              type: "React.ReactNode",
              defaultValue: "—",
              description: "The key label or symbol to display.",
            },
            {
              prop: "className",
              type: "string",
              defaultValue: "—",
              description: "Additional CSS classes to apply.",
            },
            {
              prop: "...props",
              type: `React.ComponentProps<"kbd">`,
              defaultValue: "—",
              description: "All standard kbd element props.",
            },
          ];

          const groupRows: PropRow[] = [
            {
              prop: "children",
              type: "React.ReactNode",
              defaultValue: "—",
              description:
                "Key combination content (e.g., '⌘ C' or '⌘ Shift S').",
            },
            {
              prop: "className",
              type: "string",
              defaultValue: "—",
              description: "Additional CSS classes to apply.",
            },
            {
              prop: "...props",
              type: `React.ComponentProps<"kbd">`,
              defaultValue: "—",
              description: "All standard kbd element props.",
            },
          ];

          return (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                The Kbd component displays individual keyboard keys. For key
                combinations, use either:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>
                    <strong>KbdGroup</strong>: All keys in a single pill with +
                    signs between
                  </li>
                  <li>
                    <strong>Multiple Kbd</strong>: Separate pills with + signs
                    between
                  </li>
                </ul>
              </div>
              <PropsTable title="Kbd" rows={kbdRows} />
              <PropsTable title="KbdGroup" rows={groupRows} />
            </div>
          );
        },
      },
      {
        id: "select",
        name: "Select",
        description:
          "Polished select with border highlights, smooth animations, and sliding text on hover.",
        code: `'use client'

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function Example() {
  const [value, setValue] = useState("one")

  return (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="one">One</SelectItem>
      </SelectContent>
    </Select>
  )
}`,
        previewVariants: [
          {
            id: "compact",
            name: "Compact",
            code: `<div className="w-64 space-y-2">
  <Label>Algorithm</Label>
  <Select value={value} onValueChange={setValue}>
    <SelectTrigger>
      <SelectValue placeholder="Choose an algorithm" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="floyd">Floyd-Steinberg</SelectItem>
      <SelectItem value="atkinson">Atkinson</SelectItem>
      <SelectItem value="ordered">Ordered</SelectItem>
    </SelectContent>
  </Select>
</div>`,
            Preview: function Preview() {
              const [value, setValue] = useState("floyd");
              return (
                <div className="w-64 space-y-2">
                  <Label>Algorithm</Label>
                  <Select value={value} onValueChange={setValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an algorithm" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="floyd">Floyd-Steinberg</SelectItem>
                      <SelectItem value="atkinson">Atkinson</SelectItem>
                      <SelectItem value="ordered">Ordered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            },
          },
          {
            id: "form",
            name: "In Form",
            description: "Select inside a form-like card.",
            code: `<div className="w-96 rounded-lg border bg-muted/10 p-6 space-y-4">
  <div className="space-y-2">
    <Label>Algorithm</Label>
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder="Choose an algorithm" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="floyd">Floyd-Steinberg</SelectItem>
        <SelectItem value="atkinson">Atkinson</SelectItem>
        <SelectItem value="ordered">Ordered</SelectItem>
      </SelectContent>
    </Select>
  </div>
  <p className="text-xs text-muted-foreground">This value is used by the editor.</p>
</div>`,
            Preview: function Preview() {
              const [value, setValue] = useState("floyd");
              return (
                <div className="w-96 rounded-lg border bg-muted/10 p-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Algorithm</Label>
                    <Select value={value} onValueChange={setValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an algorithm" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="floyd">Floyd-Steinberg</SelectItem>
                        <SelectItem value="atkinson">Atkinson</SelectItem>
                        <SelectItem value="ordered">Ordered</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This value is used by the editor.
                  </p>
                </div>
              );
            },
          },
        ],
        Preview: function Preview() {
          const [value, setValue] = useState("floyd");
          return (
            <div className="w-80 space-y-2">
              <Label>Dithering Algorithm</Label>
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an algorithm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="floyd">Floyd-Steinberg</SelectItem>
                  <SelectItem value="atkinson">Atkinson</SelectItem>
                  <SelectItem value="ordered">Ordered (Bayer)</SelectItem>
                  <SelectItem value="stucki">Stucki</SelectItem>
                  <SelectItem value="sierra">Sierra</SelectItem>
                  <SelectItem value="jarvis">Jarvis-Judice-Ninke</SelectItem>
                  <SelectItem value="burkes">Burkes</SelectItem>
                  <SelectItem value="false">False Floyd-Steinberg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
        ApiReference: function ApiReference() {
          const triggerRows: PropRow[] = [
            {
              prop: "...props",
              type: "React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>",
              defaultValue: "—",
              description: "All Radix trigger props (forwardRef).",
            },
          ];

          const contentRows: PropRow[] = [
            {
              prop: "position",
              type: "string",
              defaultValue: `"popper"`,
              description:
                "Forwarded to Radix content; affects layout classes.",
            },
            {
              prop: "...props",
              type: "React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>",
              defaultValue: "—",
              description: "All Radix content props (forwardRef).",
            },
          ];

          const itemRows: PropRow[] = [
            {
              prop: "...props",
              type: "React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>",
              defaultValue: "—",
              description: "All Radix item props (forwardRef).",
            },
          ];

          return (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                `Select` is a re-export of Radix `SelectPrimitive.Root`; the
                other exports are forwardRef wrappers.
              </div>
              <PropsTable title="SelectTrigger" rows={triggerRows} />
              <PropsTable title="SelectContent" rows={contentRows} />
              <PropsTable title="SelectItem" rows={itemRows} />
            </div>
          );
        },
      },
      {
        id: "slider",
        name: "Slider",
        description:
          "Smooth animated slider with track height transitions and glow effects.",
        code: `'use client'

import { useState } from "react"
import { Slider } from "@/components/ui/slider"

export function Example() {
  const [value, setValue] = useState(50)

  return (
    <Slider
      value={[value]}
      onValueChange={([v]) => setValue(v)}
    />
  )
}`,
        previewVariants: [
          {
            id: "labeled",
            name: "Labeled",
            code: `<Slider
  label="Strength"
  showValue
  unit="%"
  value={[value]}
  onValueChange={([v]) => setValue(v)}
  min={0}
  max={100}
  step={1}
/>`,
            Preview: function Preview() {
              const [value, setValue] = useState(55);
              return (
                <div className="w-96">
                  <Slider
                    label="Strength"
                    showValue
                    unit="%"
                    value={[value]}
                    onValueChange={([v]) => setValue(v)}
                    min={0}
                    max={100}
                    step={1}
                  />
                </div>
              );
            },
          },
          {
            id: "disabled",
            name: "Disabled",
            description: "Non-interactive state.",
            code: `<Slider label="Strength" showValue unit="%" value={[55]} disabled />`,
            Preview: function Preview() {
              return (
                <div className="w-96">
                  <Slider
                    label="Strength"
                    showValue
                    unit="%"
                    value={[55]}
                    disabled
                  />
                </div>
              );
            },
          },
        ],
        Preview: function Preview() {
          const [value, setValue] = useState(55);
          return (
            <div className="w-96">
              <Slider
                label="Strength"
                showValue
                unit="%"
                value={[value]}
                onValueChange={([v]) => setValue(v)}
                min={0}
                max={100}
                step={1}
              />
            </div>
          );
        },
        ApiReference: function ApiReference() {
          const rows: PropRow[] = [
            {
              prop: "min",
              type: "number",
              defaultValue: "0",
              description: "Minimum value.",
            },
            {
              prop: "max",
              type: "number",
              defaultValue: "100",
              description: "Maximum value.",
            },
            {
              prop: "step",
              type: "number",
              defaultValue: "1",
              description: "Step increment.",
            },
            {
              prop: "defaultValue",
              type: "number | number[]",
              defaultValue: "50",
              description: "Initial value.",
            },
            {
              prop: "value",
              type: "number | number[]",
              defaultValue: "—",
              description: "Controlled value.",
            },
            {
              prop: "onChange",
              type: "(value: number) => void",
              defaultValue: "—",
              description: "Called with the normalized number value.",
            },
            {
              prop: "onValueChange",
              type: "(value: number[]) => void",
              defaultValue: "—",
              description: "Called with a 1-length array value.",
            },
            {
              prop: "label",
              type: "string",
              defaultValue: "—",
              description: "Optional label used for aria-label and UI.",
            },
            {
              prop: "showValue",
              type: "boolean",
              defaultValue: "false",
              description: "Shows the current value in the header.",
            },
            {
              prop: "unit",
              type: "string",
              defaultValue: "—",
              description: "Optional unit shown next to the value.",
            },
            {
              prop: "className",
              type: "string",
              defaultValue: "—",
              description: "Wrapper className.",
            },
            {
              prop: "disabled",
              type: "boolean",
              defaultValue: "false",
              description: "Disables interaction.",
            },
          ];

          return <PropsTable title="Slider" rows={rows} />;
        },
      },
      {
        id: "tabs",
        name: "Tabs",
        description:
          "Tab navigation with moving background highlight and smooth content transitions.",
        code: `'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function Example() {
  return (
    <Tabs defaultValue="one">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
      </TabsList>
      <TabsContent value="one">Content</TabsContent>
    </Tabs>
  )
}`,
        previewVariants: [
          {
            id: "simple",
            name: "Simple",
            code: `<Tabs defaultValue="account">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">
    <div className="rounded-lg border bg-background p-6">
      <p className="text-sm text-muted-foreground">
        Account settings here.
      </p>
    </div>
  </TabsContent>
  <TabsContent value="password">
    <div className="rounded-lg border bg-background p-6">
      <p className="text-sm text-muted-foreground">
        Password settings here.
      </p>
    </div>
  </TabsContent>
</Tabs>`,
            Preview: function Preview() {
              return (
                <div className="w-[450px]">
                  <Tabs defaultValue="account">
                    <TabsList>
                      <TabsTrigger value="account">Account</TabsTrigger>
                      <TabsTrigger value="password">Password</TabsTrigger>
                    </TabsList>
                    <TabsContent value="account">
                      <div className="rounded-lg border bg-background p-6">
                        <p className="text-sm text-muted-foreground">
                          Account settings here.
                        </p>
                      </div>
                    </TabsContent>
                    <TabsContent value="password">
                      <div className="rounded-lg border bg-background p-6">
                        <p className="text-sm text-muted-foreground">
                          Password settings here.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              );
            },
          },
          {
            id: "form",
            name: "Form",
            description: "Tabs wrapping a settings form.",
            code: `<div className="w-[450px]">
  <Tabs defaultValue="account">
    <TabsList>
      <TabsTrigger value="account">Account</TabsTrigger>
      <TabsTrigger value="password">Password</TabsTrigger>
    </TabsList>
    <TabsContent value="account">
      <div className="rounded-lg border bg-background p-6 space-y-4">
        {/* form fields */}
      </div>
    </TabsContent>
  </Tabs>
</div>`,
            Preview: function Preview() {
              return (
                <div className="w-[450px]">
                  <Tabs defaultValue="account">
                    <TabsList>
                      <TabsTrigger value="account">Account</TabsTrigger>
                      <TabsTrigger value="password">Password</TabsTrigger>
                    </TabsList>
                    <TabsContent value="account">
                      <div className="rounded-lg border bg-background p-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <input
                            id="name"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-foreground/20 focus:bg-muted/30"
                            defaultValue="Pedro Duarte"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <input
                            id="username"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-foreground/20 focus:bg-muted/30"
                            defaultValue="@peduarte"
                          />
                        </div>
                        <Button>Save changes</Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="password">
                      <div className="rounded-lg border bg-background p-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="current">Current password</Label>
                          <input
                            id="current"
                            type="password"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-foreground/20 focus:bg-muted/30"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new">New password</Label>
                          <input
                            id="new"
                            type="password"
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-foreground/20 focus:bg-muted/30"
                          />
                        </div>
                        <Button>Save password</Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              );
            },
          },
        ],
        Preview: function Preview() {
          return (
            <div className="w-[450px]">
              <Tabs defaultValue="account">
                <TabsList>
                  <TabsTrigger value="account">Account</TabsTrigger>
                  <TabsTrigger value="password">Password</TabsTrigger>
                </TabsList>
                <TabsContent value="account">
                  <div className="rounded-lg border bg-background p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <input
                        id="name"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-foreground/20 focus:bg-muted/30"
                        defaultValue="Pedro Duarte"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <input
                        id="username"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-foreground/20 focus:bg-muted/30"
                        defaultValue="@peduarte"
                      />
                    </div>
                    <Button>Save changes</Button>
                  </div>
                </TabsContent>
                <TabsContent value="password">
                  <div className="rounded-lg border bg-background p-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current">Current password</Label>
                      <input
                        id="current"
                        type="password"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-foreground/20 focus:bg-muted/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new">New password</Label>
                      <input
                        id="new"
                        type="password"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all duration-200 focus:outline-none focus:border-foreground/20 focus:bg-muted/30"
                      />
                    </div>
                    <Button>Save password</Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          );
        },
        ApiReference: function ApiReference() {
          const triggerRows: PropRow[] = [
            {
              prop: "onTabChange",
              type: "(value: string) => void",
              defaultValue: "—",
              description:
                "Internal prop used by `TabsList` to animate the highlight.",
            },
            {
              prop: "registerRef",
              type: "(value: string, ref: HTMLButtonElement | null) => void",
              defaultValue: "—",
              description:
                "Internal prop used by `TabsList` to measure triggers.",
            },
            {
              prop: "...props",
              type: "React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>",
              defaultValue: "—",
              description: "All Radix trigger props (forwardRef).",
            },
          ];

          return (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                `Tabs` itself is a re-export of Radix `TabsPrimitive.Root`;
                wrappers add highlight behavior in `TabsList` + `TabsTrigger`.
              </div>
              <PropsTable title="TabsTrigger" rows={triggerRows} />
            </div>
          );
        },
      },
      {
        id: "accordion",
        name: "Accordion",
        description:
          "Expandable sections with smooth animations, collapsible content, and support for single or multiple open items.",
        code: `'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export function Example() {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>Section 1</AccordionTrigger>
        <AccordionContent>
          Content for section 1.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}`,
        previewVariants: [
          {
            id: "single",
            name: "Single",
            description: "Only one section can be open at a time.",
            code: `<Accordion type="single" collapsible defaultValue="item-1" className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>Getting Started</AccordionTrigger>
    <AccordionContent>
      Begin by installing the required dependencies and setting up your project structure.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Configuration</AccordionTrigger>
    <AccordionContent>
      Configure your environment variables and customize the settings to match your needs.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-3">
    <AccordionTrigger>Deployment</AccordionTrigger>
    <AccordionContent>
      Deploy your application to production using your preferred hosting platform.
    </AccordionContent>
  </AccordionItem>
</Accordion>`,
            Preview: function Preview() {
              return (
                <div className="w-full max-w-md">
                  <Accordion
                    type="single"
                    collapsible
                    defaultValue="item-1"
                    className="w-full"
                  >
                    <AccordionItem value="item-1">
                      <AccordionTrigger>Getting Started</AccordionTrigger>
                      <AccordionContent>
                        Begin by installing the required dependencies and
                        setting up your project structure.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Configuration</AccordionTrigger>
                      <AccordionContent>
                        Configure your environment variables and customize the
                        settings to match your needs.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger>Deployment</AccordionTrigger>
                      <AccordionContent>
                        Deploy your application to production using your
                        preferred hosting platform.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              );
            },
          },
          {
            id: "multiple",
            name: "Multiple",
            description: "Multiple sections can be open simultaneously.",
            code: `<Accordion type="multiple" className="w-full">
  <AccordionItem value="item-1">
    <AccordionTrigger>Features</AccordionTrigger>
    <AccordionContent>
      Smooth animations, keyboard navigation, and full accessibility support.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Customization</AccordionTrigger>
    <AccordionContent>
      Easily customize colors, spacing, and animations to match your design system.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-3">
    <AccordionTrigger>Performance</AccordionTrigger>
    <AccordionContent>
      Built with React and optimized for performance with minimal re-renders.
    </AccordionContent>
  </AccordionItem>
</Accordion>`,
            Preview: function Preview() {
              return (
                <div className="w-full max-w-md">
                  <Accordion type="multiple" className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger>Features</AccordionTrigger>
                      <AccordionContent>
                        Smooth animations, keyboard navigation, and full
                        accessibility support.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger>Customization</AccordionTrigger>
                      <AccordionContent>
                        Easily customize colors, spacing, and animations to
                        match your design system.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                      <AccordionTrigger>Performance</AccordionTrigger>
                      <AccordionContent>
                        Built with React and optimized for performance with
                        minimal re-renders.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              );
            },
          },
        ],
        Preview: function Preview() {
          return (
            <div className="w-full max-w-md">
              <Accordion
                type="single"
                collapsible
                defaultValue="item-1"
                className="w-full"
              >
                <AccordionItem value="item-1">
                  <AccordionTrigger>Getting Started</AccordionTrigger>
                  <AccordionContent>
                    Begin by installing the required dependencies and setting up
                    your project structure.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>Configuration</AccordionTrigger>
                  <AccordionContent>
                    Configure your environment variables and customize the
                    settings to match your needs.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>Deployment</AccordionTrigger>
                  <AccordionContent>
                    Deploy your application to production using your preferred
                    hosting platform.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          );
        },
        ApiReference: function ApiReference() {
          const rootRows: PropRow[] = [
            {
              prop: "type",
              type: `"single" | "multiple"`,
              defaultValue: "—",
              description: "Whether one or multiple items can be open at once.",
            },
            {
              prop: "collapsible",
              type: "boolean",
              defaultValue: "false",
              description: 'When type="single", allows closing the open item.',
            },
            {
              prop: "defaultValue",
              type: "string | string[]",
              defaultValue: "—",
              description: "Initially open item(s).",
            },
            {
              prop: "value",
              type: "string | string[]",
              defaultValue: "—",
              description: "Controlled open item(s).",
            },
            {
              prop: "onValueChange",
              type: "(value: string | string[]) => void",
              defaultValue: "—",
              description: "Called when open items change.",
            },
          ];

          const triggerRows: PropRow[] = [
            {
              prop: "...props",
              type: "React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>",
              defaultValue: "—",
              description: "All Radix trigger props (forwardRef).",
            },
          ];

          const contentRows: PropRow[] = [
            {
              prop: "...props",
              type: "React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>",
              defaultValue: "—",
              description: "All Radix content props (forwardRef).",
            },
          ];

          return (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground">
                This component is built on top of `@radix-ui/react-accordion`
                primitives.
              </div>
              <PropsTable title="Accordion" rows={rootRows} />
              <PropsTable title="AccordionTrigger" rows={triggerRows} />
              <PropsTable title="AccordionContent" rows={contentRows} />
            </div>
          );
        },
      },
      {
        id: "sheet",
        name: "Sheet",
        description:
          "A slide-out panel (drawer) that slides in from the side of the screen. Perfect for mobile navigation menus or side panels.",
        code: `'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function Demo() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Menu</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>
            A side drawer for navigation or additional content.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <nav className="flex flex-col gap-2">
            <a href="#" className="px-2 py-1 text-sm hover:bg-secondary rounded-md">
              Home
            </a>
            <a href="#" className="px-2 py-1 text-sm hover:bg-secondary rounded-md">
              About
            </a>
            <a href="#" className="px-2 py-1 text-sm hover:bg-secondary rounded-md">
              Services
            </a>
            <a href="#" className="px-2 py-1 text-sm hover:bg-secondary rounded-md">
              Contact
            </a>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  )
}`,
        previewVariants: [
          {
            id: "left",
            name: "Left Side",
            description: "Sheet slides in from the left side.",
            code: `import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function Example() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Left</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Left Menu</SheetTitle>
          <SheetDescription>
            This drawer slides in from the left.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">Content goes here.</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}`,
            Preview: function Preview() {
              return (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">Open Left</Button>
                  </SheetTrigger>
                  <SheetContent side="left">
                    <SheetHeader>
                      <SheetTitle>Left Menu</SheetTitle>
                    </SheetHeader>
                    <div className="py-4">
                      <nav className="flex flex-col gap-2">
                        <a
                          href="#"
                          className="px-2 py-1 text-sm hover:bg-secondary rounded-md"
                        >
                          Home
                        </a>
                        <a
                          href="#"
                          className="px-2 py-1 text-sm hover:bg-secondary rounded-md"
                        >
                          About
                        </a>
                        <a
                          href="#"
                          className="px-2 py-1 text-sm hover:bg-secondary rounded-md"
                        >
                          Services
                        </a>
                      </nav>
                    </div>
                  </SheetContent>
                </Sheet>
              );
            },
          },
          {
            id: "right",
            name: "Right Side",
            description: "Sheet slides in from the right side (default).",
            code: `import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function Example() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Right</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Right Panel</SheetTitle>
          <SheetDescription>
            This drawer slides in from the right.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">Content goes here.</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}`,
            Preview: function Preview() {
              return (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">Open Right</Button>
                  </SheetTrigger>
                  <SheetContent side="right">
                    <SheetHeader>
                      <SheetTitle>Right Panel</SheetTitle>
                    </SheetHeader>
                    <div className="py-4">
                      <p className="text-sm text-muted-foreground">
                        This is a right-side drawer. Perfect for settings panels
                        or detailed views.
                      </p>
                    </div>
                  </SheetContent>
                </Sheet>
              );
            },
          },
        ],
        Preview: function Preview() {
          return (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open Menu</Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <nav className="flex flex-col gap-2">
                    <a
                      href="#"
                      className="px-2 py-1 text-sm hover:bg-secondary rounded-md"
                    >
                      Home
                    </a>
                    <a
                      href="#"
                      className="px-2 py-1 text-sm hover:bg-secondary rounded-md"
                    >
                      About
                    </a>
                    <a
                      href="#"
                      className="px-2 py-1 text-sm hover:bg-secondary rounded-md"
                    >
                      Services
                    </a>
                    <a
                      href="#"
                      className="px-2 py-1 text-sm hover:bg-secondary rounded-md"
                    >
                      Contact
                    </a>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          );
        },
      },
      {
        id: "color-picker",
        name: "Color Picker",
        description:
          "Figma-style color picker with 2D saturation/value selector, hue and alpha sliders, multiple format outputs (HEX/RGB/HSL), eyedropper tool, and recent colors.",
        code: `'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"

export function Example() {
  const [color, setColor] = useState("#3b82f6")
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline">
        Choose Color
      </Button>
      <ColorPicker
        value={color}
        onChange={setColor}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Pick a Color"
      />
    </>
  )
}`,
        previewVariants: [
          {
            id: "basic",
            name: "Basic",
            description: "Simple color picker with a button trigger.",
            code: `import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"

export function Example() {
  const [color, setColor] = useState("#3b82f6")
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="flex items-center gap-4">
      <Button onClick={() => setIsOpen(true)} variant="outline">
        Choose Color
      </Button>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded border border-input"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm text-muted-foreground font-mono">{color}</span>
      </div>
      <ColorPicker
        value={color}
        onChange={setColor}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Pick a Color"
      />
    </div>
  )
}`,
            Preview: function Preview() {
              const [color, setColor] = useState("#3b82f6");
              const [isOpen, setIsOpen] = useState(false);

              return (
                <div className="flex items-center gap-4">
                  <Button onClick={() => setIsOpen(true)} variant="outline">
                    Choose Color
                  </Button>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded border border-input"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm text-muted-foreground font-mono">
                      {color}
                    </span>
                  </div>
                  <ColorPicker
                    value={color}
                    onChange={setColor}
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    title="Pick a Color"
                  />
                </div>
              );
            },
          },
          {
            id: "with-swatch",
            name: "With Swatch Button",
            description:
              "Color picker triggered by clicking the color swatch itself.",
            code: `import { useState } from "react"
import { ColorPicker } from "@/components/ui/color-picker"

export function Example() {
  const [strokeColor, setStrokeColor] = useState("#ef4444")
  const [fillColor, setFillColor] = useState("#10b981")
  const [showStrokePicker, setShowStrokePicker] = useState(false)
  const [showFillPicker, setShowFillPicker] = useState(false)

  return (
    <div className="flex items-center gap-4">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Stroke</label>
        <button
          onClick={() => setShowStrokePicker(true)}
          className="w-10 h-10 rounded-md border border-input hover:scale-105 transition-transform"
          style={{ backgroundColor: strokeColor }}
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Fill</label>
        <button
          onClick={() => setShowFillPicker(true)}
          className="w-10 h-10 rounded-md border border-input hover:scale-105 transition-transform"
          style={{ backgroundColor: fillColor }}
        />
      </div>

      <ColorPicker
        value={strokeColor}
        onChange={setStrokeColor}
        isOpen={showStrokePicker}
        onClose={() => setShowStrokePicker(false)}
        title="Stroke Color"
      />
      <ColorPicker
        value={fillColor}
        onChange={setFillColor}
        isOpen={showFillPicker}
        onClose={() => setShowFillPicker(false)}
        title="Fill Color"
      />
    </div>
  )
}`,
            Preview: function Preview() {
              const [strokeColor, setStrokeColor] = useState("#ef4444");
              const [fillColor, setFillColor] = useState("#10b981");
              const [showStrokePicker, setShowStrokePicker] = useState(false);
              const [showFillPicker, setShowFillPicker] = useState(false);

              return (
                <div className="flex items-center gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">
                      Stroke
                    </label>
                    <button
                      onClick={() => setShowStrokePicker(true)}
                      className="w-10 h-10 rounded-md border border-input hover:scale-105 transition-transform"
                      style={{ backgroundColor: strokeColor }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">
                      Fill
                    </label>
                    <button
                      onClick={() => setShowFillPicker(true)}
                      className="w-10 h-10 rounded-md border border-input hover:scale-105 transition-transform"
                      style={{ backgroundColor: fillColor }}
                    />
                  </div>

                  <ColorPicker
                    value={strokeColor}
                    onChange={setStrokeColor}
                    isOpen={showStrokePicker}
                    onClose={() => setShowStrokePicker(false)}
                    title="Stroke Color"
                  />
                  <ColorPicker
                    value={fillColor}
                    onChange={setFillColor}
                    isOpen={showFillPicker}
                    onClose={() => setShowFillPicker(false)}
                    title="Fill Color"
                  />
                </div>
              );
            },
          },
        ],
        Preview: function Preview() {
          const [color, setColor] = useState("#3b82f6");
          const [isOpen, setIsOpen] = useState(false);

          return (
            <div className="flex items-center gap-4">
              <Button onClick={() => setIsOpen(true)} variant="outline">
                Choose Color
              </Button>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded border border-input"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-muted-foreground font-mono">
                  {color}
                </span>
              </div>
              <ColorPicker
                value={color}
                onChange={setColor}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Pick a Color"
              />
            </div>
          );
        },
        ApiReference: function ApiReference() {
          const rows: PropRow[] = [
            {
              prop: "value",
              type: "string",
              defaultValue: "—",
              description:
                "Current color value. Accepts HEX (#RRGGBB, #RRGGBBAA), RGB, HSL, or 'transparent'.",
            },
            {
              prop: "onChange",
              type: "(color: string) => void",
              defaultValue: "—",
              description:
                "Callback when color changes. Returns color in HEX format.",
            },
            {
              prop: "isOpen",
              type: "boolean",
              defaultValue: "—",
              description: "Controls the visibility of the color picker modal.",
            },
            {
              prop: "onClose",
              type: "() => void",
              defaultValue: "—",
              description:
                "Callback when the color picker should close (clicking overlay or Escape key).",
            },
            {
              prop: "title",
              type: "string",
              defaultValue: `"Custom Color"`,
              description: "Title displayed in the color picker header.",
            },
            {
              prop: "position",
              type: `{ left: number; top: number } | "auto"`,
              defaultValue: `"auto"`,
              description:
                "Modal position. 'auto' positions it to the left of the sidebar (right: 20rem).",
            },
            {
              prop: "showAlpha",
              type: "boolean",
              defaultValue: "true",
              description: "Shows the alpha/opacity slider.",
            },
            {
              prop: "showEyedropper",
              type: "boolean",
              defaultValue: "true",
              description:
                "Shows the eyedropper button (only in supported browsers: Chrome, Edge).",
            },
            {
              prop: "showSwatches",
              type: "boolean",
              defaultValue: "true",
              description:
                "Shows recently used colors (persisted in localStorage).",
            },
          ];

          return <PropsTable title="ColorPicker" rows={rows} />;
        },
      },
    ];

    // Automatically sort components alphabetically by name
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, []);
}

interface ComponentsDocsProps {
  mobileMenuOpen?: boolean;
  onMobileMenuChange?: (open: boolean) => void;
}

export function ComponentsDocs({
  mobileMenuOpen = false,
  onMobileMenuChange,
}: ComponentsDocsProps = {}) {
  const registry = useComponentRegistry();
  const [activeId, setActiveId] = useState("introduction");
  const [activePreviewVariantId, setActivePreviewVariantId] =
    useState<string>("");
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const navRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const navContainerRef = useRef<HTMLDivElement>(null);

  const currentIndex = registry.findIndex((entry) => entry.id === activeId);
  const prevComponent = currentIndex > 0 ? registry[currentIndex - 1] : null;
  const nextComponent =
    currentIndex < registry.length - 1 ? registry[currentIndex + 1] : null;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNavigate = (id: string) => {
    setActiveId(id);
    scrollToTop();
    onMobileMenuChange?.(false);
  };

  const activeEntry = registry.find((entry) => entry.id === activeId);

  useEffect(() => {
    if (!activeEntry?.previewVariants?.length) {
      setActivePreviewVariantId("");
      return;
    }
    setActivePreviewVariantId(activeEntry.previewVariants[0].id);
  }, [activeId, activeEntry?.previewVariants]);

  useEffect(() => {
    const updateHighlight = () => {
      const activeButton = navRefs.current.get(activeId);
      if (activeButton && navContainerRef.current) {
        const containerRect = navContainerRef.current.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();

        setHighlightStyle({
          width: buttonRect.width,
          height: buttonRect.height,
          transform: `translateY(${buttonRect.top - containerRect.top}px)`,
        });
      }
    };

    if (activeId) {
      updateHighlight();
    }

    window.addEventListener("resize", updateHighlight);
    return () => window.removeEventListener("resize", updateHighlight);
  }, [activeId]);

  // Shared navigation content
  const NavigationContent = () => (
    <div className="relative space-y-4" ref={navContainerRef}>
      {activeId && (
        <div
          className="absolute z-0 top-0 left-2 rounded-md bg-secondary transition-all duration-500 ease-out"
          style={highlightStyle}
        />
      )}
      <div>
        <div className="relative z-10 text-sm font-medium text-foreground mb-2 pl-2">
          Sections
        </div>
        <nav className="grid gap-1 pl-2">
          <button
            ref={(el) => {
              if (el) navRefs.current.set("introduction", el);
              else navRefs.current.delete("introduction");
            }}
            type="button"
            className={cn(
              "relative z-10 rounded-md px-2 py-1 text-sm transition-colors hover:bg-secondary/60 text-left",
              activeId === "introduction"
                ? "text-foreground"
                : "text-muted-foreground",
            )}
            onClick={() => handleNavigate("introduction")}
          >
            Introduction
          </button>
        </nav>
      </div>
      <div>
        <div className="relative z-10 text-sm font-medium text-foreground mb-2 pl-2">
          Components
        </div>
        <nav className="grid gap-1 pl-2">
          {registry.map((entry) => (
            <button
              key={entry.id}
              ref={(el) => {
                if (el) navRefs.current.set(entry.id, el);
                else navRefs.current.delete(entry.id);
              }}
              type="button"
              className={cn(
                "relative z-10 rounded-md px-2 py-1 text-sm transition-colors hover:bg-secondary/60 text-left",
                activeId === entry.id
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
              onClick={() => handleNavigate(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile sheet - controlled from parent */}
      <Sheet open={mobileMenuOpen} onOpenChange={onMobileMenuChange}>
        <SheetContent side="left" className="w-[280px] sm:w-[320px]">
          <SheetHeader>
            <SheetTitle>Documentation</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <NavigationContent />
          </div>
        </SheetContent>
      </Sheet>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block sticky top-20 self-start">
          <NavigationContent />
        </aside>

        <div className="space-y-8">
          {activeId === "introduction" ? (
            <section className="scroll-mt-24">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Introduction
                </h2>
                <p className="text-muted-foreground">
                  A living documentation page for kladde UI components you can
                  reuse across tools.
                </p>
                <p className="text-muted-foreground">
                  Each component is designed with smooth animations, consistent
                  styling, and a muted color palette. Browse the components in
                  the sidebar to see interactive previews and copy the code
                  snippets.
                </p>
                <p className="text-muted-foreground">
                  Some entries mirror the Animate UI primitives that power parts
                  of kladde (for example, the Cursor component).
                </p>
              </div>
            </section>
          ) : activeEntry ? (
            <section
              key={activeEntry.id}
              id={activeEntry.id}
              className="scroll-mt-24"
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {activeEntry.name}
                  </h2>
                  <p className="text-muted-foreground">
                    {activeEntry.description}
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-semibold tracking-tight">
                    Preview
                  </h3>
                  {(() => {
                    const previewVariants: PreviewVariant[] = activeEntry
                      .previewVariants?.length
                      ? activeEntry.previewVariants
                      : [
                          {
                            id: "default",
                            name: "Default",
                            code: activeEntry.code,
                            Preview: activeEntry.Preview,
                          },
                        ];

                    const selectedVariant =
                      previewVariants.find(
                        (variant) => variant.id === activePreviewVariantId,
                      ) ?? previewVariants[0];

                    return (
                      <div className="space-y-4">
                        {previewVariants.length > 1 ? (
                          <Tabs
                            value={selectedVariant.id}
                            onValueChange={setActivePreviewVariantId}
                          >
                            <TabsList>
                              {previewVariants.map((variant) => (
                                <TabsTrigger
                                  key={variant.id}
                                  value={variant.id}
                                >
                                  {variant.name}
                                </TabsTrigger>
                              ))}
                            </TabsList>
                          </Tabs>
                        ) : null}

                        {selectedVariant.description ? (
                          <p className="text-sm text-muted-foreground">
                            {selectedVariant.description}
                          </p>
                        ) : null}

                        <Tabs defaultValue="preview">
                          <TabsList>
                            <TabsTrigger value="preview">Preview</TabsTrigger>
                            <TabsTrigger value="code">Code</TabsTrigger>
                          </TabsList>
                          <TabsContent value="preview">
                            <div className="rounded-lg border bg-background p-12 flex items-center justify-center min-h-[500px]">
                              <selectedVariant.Preview />
                            </div>
                          </TabsContent>
                          <TabsContent value="code">
                            <div className="w-full">
                              <StyledCodeBlock
                                code={selectedVariant.code}
                                language="tsx"
                                filename={`${activeEntry.id}.${selectedVariant.id}.tsx`}
                              />
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-semibold tracking-tight">
                    Usage
                  </h3>
                  <div className="w-full">
                    <StyledCodeBlock
                      code={activeEntry.code}
                      language="tsx"
                      filename={`${activeEntry.id}.tsx`}
                    />
                  </div>
                </div>

                {activeEntry.ApiReference ? (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold tracking-tight">
                      API Reference
                    </h3>
                    <activeEntry.ApiReference />
                  </div>
                ) : null}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between gap-4 mt-8">
                {prevComponent ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleNavigate(prevComponent.id)}
                    aria-label={`Previous: ${prevComponent.name}`}
                    title={`Previous: ${prevComponent.name}`}
                  >
                    <ArrowLeft className="size-4" />
                  </Button>
                ) : (
                  <div />
                )}

                {nextComponent ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleNavigate(nextComponent.id)}
                    aria-label={`Next: ${nextComponent.name}`}
                    title={`Next: ${nextComponent.name}`}
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <div />
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
