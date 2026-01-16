import { useState, useRef } from "react";
import { X, Upload, File, Image as ImageIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UploadedFile {
	id: string;
	file: File;
	preview?: string;
}

interface FileUploadProps {
	files: UploadedFile[];
	onFilesChange: (files: UploadedFile[]) => void;
	maxSizeMB?: number;
	maxFiles?: number;
	accept?: string;
	disabled?: boolean;
	className?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

export function FileUpload({
	files,
	onFilesChange,
	maxSizeMB = 5,
	maxFiles,
	accept,
	disabled = false,
	className,
}: FileUploadProps) {
	const [errors, setErrors] = useState<Record<string, string>>({});
	const fileInputRef = useRef<HTMLInputElement>(null);

	const maxSizeBytes = maxSizeMB * 1024 * 1024;

	const handleFileSelect = (selectedFiles: FileList | null) => {
		if (!selectedFiles) return;

		const newFiles: UploadedFile[] = [];
		const newErrors: Record<string, string> = {};

		Array.from(selectedFiles).forEach((file) => {
			// Check file size
			if (file.size > maxSizeBytes) {
				newErrors[file.name] = `File size exceeds ${maxSizeMB}MB limit`;
				return;
			}

			// Check max files
			if (maxFiles && files.length + newFiles.length >= maxFiles) {
				newErrors[file.name] = `Maximum ${maxFiles} file(s) allowed`;
				return;
			}

			// Create preview for images
			const uploadedFile: UploadedFile = {
				id: `${Date.now()}-${Math.random()}`,
				file,
			};

			if (file.type.startsWith("image/")) {
				const reader = new FileReader();
				reader.onload = (e) => {
					uploadedFile.preview = e.target?.result as string;
					onFilesChange([...files, ...newFiles, uploadedFile]);
				};
				reader.readAsDataURL(file);
			} else {
				newFiles.push(uploadedFile);
			}
		});

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
		} else {
			setErrors({});
		}

		if (
			newFiles.length > 0 &&
			!newFiles.some((f) => f.file.type.startsWith("image/"))
		) {
			onFilesChange([...files, ...newFiles]);
		}
	};

	const handleRemove = (fileId: string) => {
		const updatedFiles = files.filter((f) => f.id !== fileId);
		onFilesChange(updatedFiles);
		const updatedErrors = { ...errors };
		delete updatedErrors[fileId];
		setErrors(updatedErrors);
	};

	const handleReplace = (fileId: string) => {
		const fileInput = fileInputRef.current;
		if (!fileInput) return;

		fileInput.onchange = (e) => {
			const target = e.target as HTMLInputElement;
			if (target.files && target.files[0]) {
				const newFile = target.files[0];
				if (newFile.size > maxSizeBytes) {
					setErrors({
						...errors,
						[fileId]: `File size exceeds ${maxSizeMB}MB limit`,
					});
					return;
				}

				const updatedFiles = files.map((f) => {
					if (f.id === fileId) {
						const updated: UploadedFile = {
							id: fileId,
							file: newFile,
						};

						if (newFile.type.startsWith("image/")) {
							const reader = new FileReader();
							reader.onload = (e) => {
								updated.preview = e.target?.result as string;
								onFilesChange(
									files.map((file) => (file.id === fileId ? updated : file)),
								);
							};
							reader.readAsDataURL(newFile);
						}

						return updated;
					}
					return f;
				});

				onFilesChange(updatedFiles);
				setErrors({});
			}
		};

		fileInput.click();
	};

	const getFileIcon = (file: File) => {
		if (file.type.startsWith("image/")) {
			return ImageIcon;
		}
		return File;
	};

	return (
		<div className={cn("space-y-4", className)}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={accept}
				onChange={(e) => handleFileSelect(e.target.files)}
				className="hidden"
				disabled={disabled}
			/>

			<Button
				type="button"
				variant="outline"
				onClick={() => fileInputRef.current?.click()}
				disabled={disabled || (maxFiles ? files.length >= maxFiles : false)}
				className="w-full"
			>
				<Upload className="mr-2 h-4 w-4" />
				Upload Files (Max {maxSizeMB}MB per file
				{maxFiles ? `, ${maxFiles} files max` : ""})
			</Button>

			{Object.keys(errors).length > 0 && (
				<div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
					{Object.entries(errors).map(([fileName, error]) => (
						<div
							key={fileName}
							className="flex items-start gap-2 text-sm text-red-600"
						>
							<AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
							<span>
								<strong>{fileName}:</strong> {error}
							</span>
						</div>
					))}
				</div>
			)}

			{files.length > 0 && (
				<div className="space-y-3">
					<p className="text-sm font-medium">Uploaded Files ({files.length})</p>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{files.map((uploadedFile) => {
							const Icon = getFileIcon(uploadedFile.file);
							const fileSizeMB = (
								uploadedFile.file.size /
								(1024 * 1024)
							).toFixed(2);

							return (
								<div
									key={uploadedFile.id}
									className="relative rounded-lg border bg-card p-3"
								>
									{uploadedFile.preview ? (
										<div className="relative mb-2 aspect-video overflow-hidden rounded border">
											<img
												src={uploadedFile.preview}
												alt={uploadedFile.file.name}
												className="h-full w-full object-cover"
											/>
										</div>
									) : (
										<div className="mb-2 flex h-24 items-center justify-center rounded border bg-muted">
											<Icon className="h-8 w-8 text-muted-foreground" />
										</div>
									)}

									<div className="space-y-1">
										<p className="truncate text-xs font-medium">
											{uploadedFile.file.name}
										</p>
										<p className="text-xs text-muted-foreground">
											{fileSizeMB} MB
										</p>
									</div>

									<div className="mt-2 flex gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => handleReplace(uploadedFile.id)}
											disabled={disabled}
											className="flex-1 text-xs"
										>
											Replace
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => handleRemove(uploadedFile.id)}
											disabled={disabled}
											className="text-xs"
										>
											<X className="h-3 w-3" />
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
