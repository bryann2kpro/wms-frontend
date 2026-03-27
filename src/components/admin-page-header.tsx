import type * as React from "react";

type AdminPageHeaderProps = {
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
	/** ID used for aria-labelledby on the page's <main> */
	titleId: string;
	/** ID used for aria-describedby on the page's <main> */
	descriptionId: string;
	/**
	 * CSS custom property name for the accent color.
	 * Defaults to --dashboard-accent, but pages like RBAC or invoice-detail
	 * can pass their own, e.g. "--rbac-accent".
	 */
	accentCssVar?: string;
	/** Optional right-aligned content (e.g. help button, extra actions) */
	rightSlot?: React.ReactNode;
};

export function AdminPageHeader({
	icon: Icon,
	title,
	description,
	titleId,
	descriptionId,
	accentCssVar = "--dashboard-accent",
	rightSlot,
}: AdminPageHeaderProps) {
	const accentVar = `var(${accentCssVar})`;

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="space-y-2">
				<div className="flex items-center gap-2.5">
					<div
						className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
						style={{ background: accentVar }}
					>
						<Icon className="h-4.5 w-4.5 text-white" />
					</div>
					<h1
						id={titleId}
						className="text-2xl font-bold tracking-tight"
						style={{ fontFamily: "var(--dashboard-display)" }}
					>
						{title}
					</h1>
				</div>
				<div className="pl-11.5 space-y-1.5">
					<p
						id={descriptionId}
						className="text-sm text-muted-foreground"
						style={{ fontFamily: "var(--dashboard-body)" }}
					>
						{description}
					</p>
					<div
						style={{
							height: "3px",
							width: "3rem",
							borderRadius: "9999px",
							background: `linear-gradient(to right, ${accentVar}, transparent)`,
						}}
					/>
				</div>
			</div>
			{rightSlot ? <div className="self-start">{rightSlot}</div> : null}
		</div>
	);
}
