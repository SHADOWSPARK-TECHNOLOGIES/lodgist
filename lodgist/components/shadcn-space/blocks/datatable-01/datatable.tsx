"use client"
import { useState } from "react";
import {
    createColumnHelper,
    useReactTable,
    getCoreRowModel,
    flexRender,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface TableType2 {
    name: string;
    email: string;
    role: string;
    plan: string;
    billing: string;
    status: string;
    avatar: string;
}

const basicTableData: TableType2[] = [
    {
        name: "Olivia Rhye",
        email: "olivia@ui.com",
        role: "Maintainer",
        plan: "Enterprise",
        billing: "Auto debit",
        status: "Active",
        avatar: "https://images.shadcnspace.com/assets/profiles/user-11.jpg",
    },
    {
        name: "Barbara Steele",
        email: "steele@ui.com",
        role: "Admin",
        plan: "Enterprise",
        billing: "Auto debit",
        status: "Inactive",
        avatar: "https://images.shadcnspace.com/assets/profiles/user-8.jpg",
    },
    {
        name: "Leonard Gordon",
        email: "leonard@ui.com",
        role: "Editor",
        plan: "Team",
        billing: "Manual - PayPal",
        status: "Active",
        avatar: "https://images.shadcnspace.com/assets/profiles/user-3.jpg",
    },
    {
        name: "Evelyn Pope",
        email: "evelyn@ui.com",
        role: "Author",
        plan: "Basic",
        billing: "Manual - cash",
        status: "Pending",
        avatar: "https://images.shadcnspace.com/assets/profiles/user-4.jpg",
    },
    {
        name: "Tommy Garza",
        email: "tommy@ui.com",
        role: "Subscriber",
        plan: "Company",
        billing: "Auto debit",
        status: "Inactive",
        avatar: "https://images.shadcnspace.com/assets/profiles/user-5.jpg",
    },
    {
        name: "Isabel Vasquez",
        email: "isabel@ui.com",
        role: "Editor",
        plan: "Team",
        billing: "Auto debit",
        status: "Active",
        avatar: "https://images.shadcnspace.com/assets/profiles/user-12.jpg",
    }
];

// Colors for status badges
const statusColors: Record<string, string> = {
    Active: "bg-teal-400/10 text-teal-400 hover:bg-teal-400/10",
    Pending: "bg-orange-400/10 text-orange-400 hover:bg-orange-400/10",
    Inactive: "bg-red-500/10 text-red-500 hover:bg-red-500/10",
};

const columnHelper = createColumnHelper<TableType2>();

const columns = [
    columnHelper.accessor("name", {
        header: () => <span>User</span>,
        cell: (info) => (
            <div className="flex gap-3 items-center">
                <img
                    src={info.row.original.avatar}
                    alt="avatar"
                    height={40}
                    width={40}
                    className="h-10 w-10 rounded-full"
                />
                <div>
                    <h6 className="text-sm font-medium">{info.getValue()}</h6>
                    <p className="text-xs text-muted-foreground">
                        {info.row.original.email}
                    </p>
                </div>
            </div>
        ),
    }),
    columnHelper.accessor("role", {
        header: () => <span>Role</span>,
        cell: (info) => (
            <span className="text-sm">{info.getValue()}</span>
        ),
    }),
    columnHelper.accessor("plan", {
        header: () => <span>Plan</span>,
        cell: (info) => (
            <span className="text-sm">{info.getValue()}</span>
        ),
    }),
    columnHelper.accessor("billing", {
        header: () => <span>Billing</span>,
        cell: (info) => (
            <span className="text-sm">{info.getValue()}</span>
        ),
    }),
    columnHelper.accessor("status", {
        header: () => <span>Status</span>,
        cell: (info) => (
            <Badge className={`${statusColors[info.getValue()]} border-0 capitalize shadow-none`}>
                {info.getValue()}
            </Badge>
        ),
    }),
];

const Datatable = () => {
    const [data] = useState(basicTableData);

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const handleDownload = () => {
        const headers = ["Name", "Email", "Role", "Plan", "Billing", "Status"];

        const csvRows = data.map((item) =>
            [
                `"${item.name}"`,
                `"${item.email}"`,
                `"${item.role}"`,
                `"${item.plan}"`,
                `"${item.billing}"`,
                `"${item.status}"`,
            ].join(",")
        );

        const csvContent = [headers.join(","), ...csvRows].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "table-data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <section className="lg:py-20 sm:py-16 py-8 px-4 max-w-4xl mx-auto">
            {/* Toolbar */}
            <div className="flex items-center justify-end mb-3">
                <Button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 cursor-pointer hover:bg-primary/80"
                >
                    <Download size={15} />
                    Export CSV
                </Button>
            </div>

            <div className="border rounded-md border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <Table className="min-w-full">
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className="text-base font-medium text-left border-b border-border px-4 py-3 h-auto"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody className="divide-y divide-border">
                            {table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            className="whitespace-nowrap py-3 px-4"
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </section>
    );
};

export default Datatable;