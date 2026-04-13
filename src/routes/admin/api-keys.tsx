import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	KeyRound,
	Plus,
	Copy,
	Check,
	Trash2,
	ShieldAlert,
	Clock,
	Activity,
	Eye,
	EyeOff,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	fetchApiKeys,
	createApiKey,
	revokeApiKey,
	type ApiKey,
	type CreateApiKeyInput,
} from "@/lib/api-keys/api-keys-api";
import { formatDateMedium, timeAgo } from "@/lib/utils";

// ============================================
// ROUTE
// ============================================

export const Route = createFileRoute("/admin/api-keys")({
	component: ApiKeysPage,
	head: () => ({
		meta: [
			{
				title: "API Keys - SME Edaran WMS",
				description:
					"Manage access tokens for third-party integrations. Keys are hashed — the raw value is shown only once on creation.",
			},
		],
	}),
});

// ============================================
// CONSTANTS
// ============================================

const QUERY_KEY = ["api-keys"] as const;

// ============================================
// SUB-COMPONENTS
// ============================================

function SummaryCard({
	icon: Icon,
	label,
	value,
	accent,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: number | string;
	accent?: string;
}) {
	return (
		<div className="dashboard-card rounded-xl border bg-card p-5 flex items-center gap-4">
			<div
				className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
				style={{ background: accent ?? "var(--dashboard-accent)" }}
			>
				<Icon className="h-5 w-5 text-white" />
			</div>
			<div>
				<p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
					{label}
				</p>
				<p
					className="text-2xl font-bold mt-0.5"
					style={{ fontFamily: "var(--dashboard-display)" }}
				>
					{value}
				</p>
			</div>
		</div>
	);
}

function KeyRow({
	apiKey,
	onRevoke,
}: {
	apiKey: ApiKey;
	onRevoke: (key: ApiKey) => void;
}) {
	return (
		<tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
			{/* Name */}
			<td className="px-4 py-3.5">
				<div className="flex items-center gap-2.5">
					<div
						className="h-2 w-2 rounded-full shrink-0"
						style={{
							background: apiKey.isActive
								? "var(--dashboard-accent)"
								: "var(--muted-foreground)",
						}}
					/>
					<span
						className="font-medium text-sm"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						{apiKey.name}
					</span>
				</div>
			</td>

			{/* Prefix */}
			<td className="px-4 py-3.5">
				<span
					className="font-mono text-xs px-2 py-1 rounded-md"
					style={{
						background: "var(--dashboard-accent-muted)",
						color: "var(--dashboard-accent)",
					}}
				>
					{apiKey.keyPrefix}••••••••
				</span>
			</td>

			{/* Status */}
			<td className="px-4 py-3.5">
				{apiKey.isActive ? (
					<Badge
						variant="outline"
						className="text-xs font-medium gap-1"
						style={{
							borderColor: "var(--dashboard-accent)",
							color: "var(--dashboard-accent)",
							background: "var(--dashboard-accent-muted)",
						}}
					>
						<span className="h-1.5 w-1.5 rounded-full bg-current inline-block" />
						Active
					</Badge>
				) : (
					<Badge variant="outline" className="text-xs text-muted-foreground">
						Revoked
					</Badge>
				)}
			</td>

			{/* Last Used */}
			<td className="px-4 py-3.5">
				<span
					className="text-sm text-muted-foreground"
					title={formatDateMedium(apiKey.lastUsedAt)}
				>
					{timeAgo(apiKey.lastUsedAt)}
				</span>
			</td>

			{/* Expiry */}
			<td className="px-4 py-3.5">
				<span className="text-sm text-muted-foreground">
					{apiKey.expiresAt ? formatDateMedium(apiKey.expiresAt) : "Never"}
				</span>
			</td>

			{/* Created */}
			<td className="px-4 py-3.5">
				<span className="text-sm text-muted-foreground">
					{formatDateMedium(apiKey.createdAt)}
				</span>
			</td>

			{/* Actions */}
			<td className="px-4 py-3.5 text-right">
				{apiKey.isActive && (
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
						onClick={() => onRevoke(apiKey)}
						title="Revoke key"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				)}
			</td>
		</tr>
	);
}

// ============================================
// GENERATE KEY DIALOG
// ============================================

function GenerateKeyDialog({
	open,
	onOpenChange,
	onSuccess,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	onSuccess: (rawKey: string, name: string) => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [expiresAt, setExpiresAt] = useState("");

	const mutation = useMutation({
		mutationFn: (input: CreateApiKeyInput) => createApiKey(input),
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
			onOpenChange(false);
			setName("");
			setExpiresAt("");
			onSuccess(res.data.rawKey, res.data.name);
		},
		onError: (err: Error) => {
			toast.error("Failed to create API key", { description: err.message });
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		const input: CreateApiKeyInput = { name: name.trim() };
		if (expiresAt) input.expiresAt = expiresAt;
		mutation.mutate(input);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle
						className="flex items-center gap-2"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						<div
							className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
							style={{ background: "var(--dashboard-accent)" }}
						>
							<KeyRound className="h-3.5 w-3.5 text-white" />
						</div>
						Generate API Key
					</DialogTitle>
					<DialogDescription>
						The raw key is shown{" "}
						<span className="font-semibold text-foreground">once only</span>{" "}
						after creation. Save it immediately.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4 pt-1">
					<div className="space-y-1.5">
						<label
							className="text-sm font-medium"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Key name <span className="text-destructive">*</span>
						</label>
						<Input
							placeholder='e.g. "Empire Sushi Integration"'
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							autoFocus
						/>
						<p className="text-xs text-muted-foreground">
							A label to identify this key in the dashboard.
						</p>
					</div>

					<div className="space-y-1.5">
						<label
							className="text-sm font-medium"
							style={{ fontFamily: "var(--dashboard-display)" }}
						>
							Expiry date{" "}
							<span className="text-muted-foreground font-normal">
								(optional)
							</span>
						</label>
						<Input
							type="datetime-local"
							value={expiresAt}
							onChange={(e) => setExpiresAt(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Leave blank for a key that never expires.
						</p>
					</div>

					<DialogFooter className="pt-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={mutation.isPending}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!name.trim() || mutation.isPending}
							style={{ background: "var(--dashboard-accent)", color: "white" }}
						>
							{mutation.isPending ? "Generating…" : "Generate Key"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ============================================
// RAW KEY REVEAL DIALOG
// ============================================

function RawKeyRevealDialog({
	rawKey,
	keyName,
	onClose,
}: {
	rawKey: string | null;
	keyName: string;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);
	const [visible, setVisible] = useState(false);

	function copyKey() {
		if (!rawKey) return;
		navigator.clipboard.writeText(rawKey).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}

	const display = visible ? (rawKey ?? "") : "•".repeat(64);

	return (
		<Dialog open={!!rawKey} onOpenChange={() => onClose()}>
			<DialogContent className="sm:max-w-lg">
				{/* Warning banner */}
				<div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
					<ShieldAlert className="h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
					<div>
						<p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
							Save this key — it won't be shown again
						</p>
						<p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
							This is the only time the full API key is visible. Copy it now and
							store it securely before closing this dialog.
						</p>
					</div>
				</div>

				<DialogHeader className="mt-1">
					<DialogTitle style={{ fontFamily: "var(--dashboard-display)" }}>
						API Key: {keyName}
					</DialogTitle>
					<DialogDescription>
						Share this key with your integration partner via a secure channel.
					</DialogDescription>
				</DialogHeader>

				{/* Key display */}
				<div className="space-y-2">
					<label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						Raw API Key
					</label>
					<div
						className="relative rounded-lg border p-3.5 font-mono text-sm break-all leading-relaxed"
						style={{
							background: "var(--dashboard-accent-muted)",
							borderColor: "var(--dashboard-accent)",
							color: "var(--dashboard-accent)",
							minHeight: "4rem",
						}}
					>
						<span className="select-all pr-16">{display}</span>

						{/* Eye toggle */}
						<button
							type="button"
							onClick={() => setVisible((v) => !v)}
							className="absolute top-2.5 right-10 p-1 rounded text-current opacity-60 hover:opacity-100 transition-opacity"
							title={visible ? "Hide key" : "Show key"}
						>
							{visible ? (
								<EyeOff className="h-3.5 w-3.5" />
							) : (
								<Eye className="h-3.5 w-3.5" />
							)}
						</button>

						{/* Copy button */}
						<button
							type="button"
							onClick={copyKey}
							className="absolute top-2.5 right-2.5 p-1 rounded text-current opacity-60 hover:opacity-100 transition-opacity"
							title="Copy to clipboard"
						>
							{copied ? (
								<Check className="h-3.5 w-3.5" />
							) : (
								<Copy className="h-3.5 w-3.5" />
							)}
						</button>
					</div>

					<Button
						className="w-full gap-2"
						onClick={copyKey}
						style={{ background: "var(--dashboard-accent)", color: "white" }}
					>
						{copied ? (
							<>
								<Check className="h-4 w-4" />
								Copied!
							</>
						) : (
							<>
								<Copy className="h-4 w-4" />
								Copy API Key
							</>
						)}
					</Button>
				</div>

				<DialogFooter>
					<p className="text-xs text-muted-foreground mr-auto">
						Pass it via <code className="font-mono">x-api-key</code> header.
					</p>
					<Button variant="outline" onClick={onClose}>
						I've saved it, close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ============================================
// REVOKE CONFIRM DIALOG
// ============================================

function RevokeDialog({
	apiKey,
	onClose,
}: {
	apiKey: ApiKey | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		mutationFn: (id: string) => revokeApiKey(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QUERY_KEY });
			toast.success("API key revoked");
			onClose();
		},
		onError: (err: Error) => {
			toast.error("Failed to revoke key", { description: err.message });
		},
	});

	return (
		<Dialog open={!!apiKey} onOpenChange={() => onClose()}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle
						className="flex items-center gap-2"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						<div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 bg-destructive/10">
							<Trash2 className="h-3.5 w-3.5 text-destructive" />
						</div>
						Revoke Key
					</DialogTitle>
					<DialogDescription>
						Are you sure you want to revoke{" "}
						<span className="font-semibold text-foreground">
							{apiKey?.name}
						</span>
						? Any integration using it will stop working immediately.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="pt-2">
					<Button
						variant="outline"
						onClick={onClose}
						disabled={mutation.isPending}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={mutation.isPending}
						onClick={() => apiKey && mutation.mutate(apiKey.id)}
					>
						{mutation.isPending ? "Revoking…" : "Revoke Key"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ============================================
// EMPTY STATE
// ============================================

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-20 text-center">
			<div
				className="h-16 w-16 rounded-2xl flex items-center justify-center mb-5"
				style={{ background: "var(--dashboard-accent-muted)" }}
			>
				<KeyRound
					className="h-8 w-8"
					style={{ color: "var(--dashboard-accent)" }}
				/>
			</div>
			<h3
				className="text-lg font-semibold mb-1.5"
				style={{ fontFamily: "var(--dashboard-display)" }}
			>
				No API keys yet
			</h3>
			<p className="text-sm text-muted-foreground max-w-xs mb-6">
				Generate your first API key to allow third-party integrations to
				securely call your endpoints.
			</p>
			<Button
				onClick={onGenerate}
				className="gap-2"
				style={{ background: "var(--dashboard-accent)", color: "white" }}
			>
				<Plus className="h-4 w-4" />
				Generate First Key
			</Button>
		</div>
	);
}

// ============================================
// MAIN PAGE
// ============================================

function ApiKeysPage() {
	const [isGenerateOpen, setIsGenerateOpen] = useState(false);
	const [revealedKey, setRevealedKey] = useState<{
		rawKey: string;
		name: string;
	} | null>(null);
	const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

	const { data, isLoading, isError } = useQuery({
		queryKey: QUERY_KEY,
		queryFn: () => fetchApiKeys(),
		staleTime: 30_000,
	});

	const keys = data?.data ?? [];
	const activeKeys = keys.filter((k) => k.isActive);
	const lastUsed = keys
		.filter((k) => k.lastUsedAt)
		.sort(
			(a, b) =>
				new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime(),
		)[0];

	return (
		<>
			<main
				className="api-keys-page min-h-screen bg-[var(--dashboard-surface)]"
				aria-labelledby="apikeys-title"
				aria-describedby="apikeys-desc"
			>
				{/* Subtle gradient band — matches other admin pages */}
				<div
					className="pointer-events-none fixed left-0 right-0 top-0 h-[420px] bg-gradient-to-b from-[var(--dashboard-accent-muted)]/30 via-transparent to-transparent"
					aria-hidden
				/>

				<div className="relative container mx-auto px-6 py-8 space-y-8">
					{/* Header */}
					<AdminPageHeader
						icon={KeyRound}
						title="API Keys"
						description="Manage access tokens for third-party integrations. Keys are hashed — the raw value is shown only once on creation."
						titleId="apikeys-title"
						descriptionId="apikeys-desc"
						accentCssVar="--dashboard-accent"
						rightSlot={
							<Button
								onClick={() => setIsGenerateOpen(true)}
								className="gap-2 h-9"
								style={{
									background: "var(--dashboard-accent)",
									color: "white",
								}}
							>
								<Plus className="h-4 w-4" />
								Generate Key
							</Button>
						}
					/>

					{/* Summary cards */}
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<SummaryCard
							icon={KeyRound}
							label="Total Keys"
							value={keys.length}
						/>
						<SummaryCard
							icon={Activity}
							label="Active Keys"
							value={activeKeys.length}
							accent="oklch(0.55 0.15 145)"
						/>
						<SummaryCard
							icon={Clock}
							label="Last Used"
							value={timeAgo(lastUsed?.lastUsedAt ?? null)}
							accent="oklch(0.60 0.15 55)"
						/>
					</div>

					{/* Table card */}
					<div className="rounded-xl border bg-card overflow-hidden">
						<div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
							<h2
								className="text-sm font-semibold"
								style={{ fontFamily: "var(--dashboard-display)" }}
							>
								All Keys
							</h2>
							<span className="text-xs text-muted-foreground">
								{keys.length} key{keys.length !== 1 ? "s" : ""}
							</span>
						</div>

						{isLoading ? (
							<div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
								<div
									className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin"
									style={{ borderColor: "var(--dashboard-accent)" }}
								/>
								Loading keys…
							</div>
						) : isError ? (
							<div className="flex items-center justify-center py-16 text-sm text-destructive">
								Failed to load API keys. Please refresh.
							</div>
						) : keys.length === 0 ? (
							<EmptyState onGenerate={() => setIsGenerateOpen(true)} />
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left">
									<thead>
										<tr className="border-b border-border/50">
											{[
												"Name",
												"Key Prefix",
												"Status",
												"Last Used",
												"Expires",
												"Created",
												"",
											].map((h) => (
												<th
													key={h}
													className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide"
												>
													{h}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{keys.map((key) => (
											<KeyRow
												key={key.id}
												apiKey={key}
												onRevoke={setKeyToRevoke}
											/>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>

					{/* Usage hint */}
					<div
						className="rounded-lg border px-5 py-4"
						style={{
							borderColor:
								"color-mix(in oklch, var(--dashboard-accent) 25%, transparent)",
							background:
								"color-mix(in oklch, var(--dashboard-accent) 4%, white)",
						}}
					>
						<p
							className="text-xs font-medium mb-1"
							style={{ color: "var(--dashboard-accent)" }}
						>
							How to use
						</p>
						<p className="text-xs text-muted-foreground">
							Pass the key as a request header:{" "}
							<code
								className="font-mono px-1.5 py-0.5 rounded text-xs text-white"
								style={{ background: "var(--dashboard-accent)" }}
							>
								x-api-key: &lt;your-key&gt;
							</code>
						</p>
					</div>
				</div>
			</main>

			{/* Dialogs */}
			<GenerateKeyDialog
				open={isGenerateOpen}
				onOpenChange={setIsGenerateOpen}
				onSuccess={(rawKey, name) => setRevealedKey({ rawKey, name })}
			/>

			<RawKeyRevealDialog
				rawKey={revealedKey?.rawKey ?? null}
				keyName={revealedKey?.name ?? ""}
				onClose={() => setRevealedKey(null)}
			/>

			<RevokeDialog apiKey={keyToRevoke} onClose={() => setKeyToRevoke(null)} />
		</>
	);
}
