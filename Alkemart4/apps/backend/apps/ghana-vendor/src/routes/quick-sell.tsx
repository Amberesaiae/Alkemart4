import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useRef } from "react"
import { useUploadImage, useQuickSell } from "../lib/hooks"
import { Button, Input, Label, Card } from "../components/ui"
import { UploadCloud, Image as ImageIcon, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react"

export const Route = createFileRoute('/quick-sell')({
  component: QuickSellPage,
})

function QuickSellPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  
  const [title, setTitle] = useState("")
  const [priceGhs, setPriceGhs] = useState("")
  const [description, setDescription] = useState("")
  
  const upload = useUploadImage()
  const quickSell = useQuickSell()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
      setStep(2)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !priceGhs) return

    try {
      let imageUrl = undefined
      if (file) {
        imageUrl = await upload.mutateAsync(file)
      }

      await quickSell.mutateAsync({
        title,
        price_ghs: Number(priceGhs),
        description,
        image_url: imageUrl
      })

      navigate({ to: "/products" })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => step === 2 ? setStep(1) : navigate({ to: "/" })}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Quick Sell</h1>
          <p className="text-muted-foreground font-medium">List an item in under a minute.</p>
        </div>
      </div>

      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground'}`}>1</div>
          <div className={`h-1 w-12 rounded-full transition-colors ${step === 2 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</div>
        </div>
      </div>

      <Card className="border-2 shadow-lg overflow-hidden">
        {step === 1 && (
          <div className="p-8 sm:p-12 flex flex-col items-center text-center">
            <div className="h-24 w-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
              <ImageIcon className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Snap a Photo</h2>
            <p className="text-muted-foreground font-medium max-w-sm mb-8">
              A clear, well-lit photo makes your item sell faster.
            </p>
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <Button 
              size="lg" 
              className="w-full sm:w-auto min-w-[200px] h-14 text-lg gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-6 w-6" />
              Upload Photo
            </Button>

            <Button 
              variant="ghost" 
              className="mt-4 text-muted-foreground"
              onClick={() => setStep(2)}
            >
              Skip photo for now
            </Button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-full sm:w-1/3">
                <div 
                  className="aspect-square bg-muted rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden relative cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <span className="text-xs font-semibold text-muted-foreground">Add Photo</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-semibold text-sm">Change</span>
                  </div>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>

              <div className="w-full sm:w-2/3 space-y-5">
                {upload.isError || quickSell.isError && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm font-semibold rounded-lg border border-destructive/20">
                    Failed to list product. Please try again.
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-base">What are you selling?</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="e.g. Fresh Tomatoes, Ankara Fabric..." 
                    autoFocus
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-base">Price (GHS)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₵</span>
                    <Input 
                      id="price" 
                      type="number" 
                      min="0"
                      step="0.01"
                      className="pl-10 font-bold"
                      value={priceGhs} 
                      onChange={e => setPriceGhs(e.target.value)} 
                      placeholder="0.00" 
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc" className="text-base">Details <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <textarea 
                    id="desc"
                    className="flex w-full rounded-md border-2 border-border bg-card px-4 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:border-ring resize-none min-h-[100px]"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Size, condition, origin..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/products" })} disabled={upload.isPending || quickSell.isPending}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="lg" 
                className="gap-2 px-8"
                isLoading={upload.isPending || quickSell.isPending}
              >
                <CheckCircle2 className="h-5 w-5" />
                Publish to Store
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}