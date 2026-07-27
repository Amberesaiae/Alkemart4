interface PageHeaderProps {
  title: string
  description?: string
}

function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{title}</h1>
      {description && <p className="text-muted-foreground font-medium mt-1">{description}</p>}
    </div>
  )
}

export { PageHeader }
