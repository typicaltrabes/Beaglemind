'use client';

import { Breadcrumb } from '@/components/breadcrumb';
import { SharedLinksTable } from '@/components/share/shared-links-table';

export default function SharedLinksPage() {
  return (
    <>
      <Breadcrumb trail={["BEAGLELABS", "SHARED LINKS"]} />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Shared Links</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage replay share links for your organization
          </p>
        </div>
        <SharedLinksTable />
      </div>
    </>
  );
}
