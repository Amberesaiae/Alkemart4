import { createFileRoute } from "@tanstack/react-router"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Slider,
  ToggleGroup,
  ToggleGroupItem,
  Badge,
  Separator,
} from "@workspace/ui"
import { useState } from "react"

export const Route = createFileRoute("/")({
  component: HomeLab,
})

function HomeLab() {
  const [price, setPrice] = useState<number[]>([20, 80])
  const [view, setView] = useState("grid")

  return (
    <div className="space-y-10" id="foundation">
      <section className="space-y-3">
        <Badge className="bg-primary text-primary-foreground">Mowafer lab · foundation</Badge>
        <h1 className="text-3xl font-bold tracking-tight">shadcn / Radix design foundation</h1>
        <p className="max-w-2xl text-muted-foreground">
          Reusable primitives live in <code className="text-foreground">@workspace/ui</code>. This
          app (port 5176) consumes them and will grow into the Mowafer-shaped storefront without
          patching production <code className="text-foreground">apps/storefront</code>.
        </p>
      </section>

      <Separator />

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Primary yellow capsule CTAs</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button>Add</Button>
            <Button variant="outline" className="rounded-full">
              View More
            </Button>
            <Button variant="secondary">Secondary</Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open filters</Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Mobile filter sheet</SheetTitle>
                </SheetHeader>
                <p className="mt-4 text-sm text-muted-foreground">
                  PLP side panels collapse into this sheet under 768px.
                </p>
              </SheetContent>
            </Sheet>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form atoms</CardTitle>
            <CardDescription>Input · Label · RadioGroup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input id="search" placeholder="Find products with best price" />
            </div>
            <RadioGroup defaultValue="food" className="gap-3">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="food" id="food" />
                <Label htmlFor="food">Food</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="electronics" id="electronics" />
                <Label htmlFor="electronics">Electronics</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Price range</CardTitle>
            <CardDescription>Dual-thumb Slider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Slider value={price} onValueChange={setPrice} max={100} step={1} minStepsBetweenThumbs={1} />
            <p className="text-sm text-muted-foreground">
              ₵{price[0]} – ₵{price[1]}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>View mode</CardTitle>
            <CardDescription>ToggleGroup grid | list</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v)}
              variant="outline"
            >
              <ToggleGroupItem value="grid" aria-label="Grid">
                Grid
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List">
                List
              </ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl bg-primary p-6 text-primary-foreground">
        <h2 className="text-xl font-bold">Advertise / Sell band</h2>
        <p className="mt-1 text-sm opacity-90">Yellow full-bleed band placeholder for Sell on Alkemart.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            className="max-w-xs bg-background text-foreground"
            placeholder="Email or phone"
          />
          <Button variant="secondary">Subscribe</Button>
        </div>
      </section>
    </div>
  )
}
