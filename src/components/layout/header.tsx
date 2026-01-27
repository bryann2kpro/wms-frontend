import { Bell, Search, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthActions } from "@/lib/auth/use-auth-actions";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
	const navigate = useNavigate();
	const { logout } = useAuthActions();
	const { user } = useCurrentUser();

	const handleLogout = () => {
		logout();
		navigate({ to: "/login" });
	};

	return (
		<header className="flex h-16 items-center justify-between border-b bg-background px-6">
			<div className="flex flex-1 items-center gap-4">
				<div className="relative w-full max-w-md">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						type="search"
						placeholder="Search GRN, Transfer Orders, Deliveries..."
						className="pl-9"
					/>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<Button variant="ghost" size="icon" className="relative">
					<Bell className="h-5 w-5" />
					<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
				</Button>


				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="relative h-10 w-10 rounded-full">
							<Avatar className="h-10 w-10">
								<AvatarImage src={`http://210.187.49.131:913/9.x/glass/svg?seed=${user?.displayName}`} alt={user?.displayName ?? ""} />
								<AvatarFallback>{user?.displayName?.charAt(0) ?? <UserIcon className="h-4 w-4" />}</AvatarFallback>
							</Avatar>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent className="w-56" align="end" forceMount>
						<DropdownMenuLabel className="font-normal">
							<div className="flex flex-col space-y-1">
								<p className="text-sm font-medium leading-none">{user?.displayName}</p>
								<p className="text-xs leading-none text-muted-foreground">
									{user?.email}
								</p>
								<p className="mt-1 text-xs font-medium text-primary leading-none">
									{user?.roles?.[0]}
								</p>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleLogout}>
							<LogOut className="h-4 w-4" />
							<span>Log out</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
}
