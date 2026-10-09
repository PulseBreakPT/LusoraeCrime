import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster noir-toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast sub-toast noir-toast",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "noir-toast-action",
          cancelButton:
            "noir-toast-cancel",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
