import { useNavigate } from "react-router-dom";
import { Globe, LogOut, Settings2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/hooks/useLogout";

/** The store initial in the top bar: opens the account menu. */
export default function AccountMenu({ businessName }: { businessName: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const logout = useLogout();
  const initial = (businessName.charAt(0) || "S").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/80 to-violet-600/80 text-sm font-semibold text-white outline-none ring-offset-2 ring-offset-[#070b17] transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-blue-400 data-[state=open]:ring-2 data-[state=open]:ring-blue-400/60"
        aria-label="Account menu"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-xl border-white/10 bg-[#0d1426] p-1.5 text-slate-200">
        <DropdownMenuLabel className="px-2.5 py-2 font-normal">
          <p className="truncate text-sm font-semibold text-white">{businessName || "Your store"}</p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem className="cursor-pointer rounded-lg px-2.5 py-2 focus:bg-white/[0.06] focus:text-white" onSelect={() => navigate("/dashboard/chatbot")}>
          <Settings2 className="mr-2 h-4 w-4" /> Chatbot settings
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer rounded-lg px-2.5 py-2 focus:bg-white/[0.06] focus:text-white" onSelect={() => navigate("/")}>
          <Globe className="mr-2 h-4 w-4" /> ShopMind home page
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          className="cursor-pointer rounded-lg px-2.5 py-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
          onSelect={() => void logout()}
        >
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
