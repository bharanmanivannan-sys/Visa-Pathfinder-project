import { getListVisaResourcesQueryKey, useListVisaResources, type ListVisaResourcesPurposeTag, type VisaResource } from "@workspace/api-client-react";
import { AlertTriangle, BadgeCheck, ExternalLink, Info } from "lucide-react";

type ResourceQueryProps = {
  destinationCountry: string;
  passportCountry: string;
};

function monitoringMessage(resource: VisaResource): string {
  switch (resource.monitoringStatus) {
    case "pending_policy_review":
      return "Automated checks pending source-access review";
    case "not_checked":
      return "First automated check is pending";
    case "changed_pending_review":
      return "Source page changed; update is awaiting review";
    case "unavailable":
      return "Latest source check could not be completed";
    case "current":
      return resource.lastCheckedAt
        ? `Checked ${new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(resource.lastCheckedAt))}`
        : "Source checked";
  }
}

function ResourceCard({ resource }: { resource: VisaResource }) {
  const hasChange = resource.monitoringStatus === "changed_pending_review";
  const needsAttention = hasChange || resource.monitoringStatus === "unavailable";
  return (
    <article
      data-testid={`card-government-resource-${resource.id}`}
      className="flex min-h-[185px] flex-col rounded-xl border border-[#dce0d7] bg-[#fffdf7] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f1d9] px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[.08em] text-[#276047]">
          <BadgeCheck size={12} /> Official
        </span>
        <span className="font-label text-[9px] uppercase tracking-[.08em] text-[#8a919b]">
          Reviewed {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(resource.reviewedOn))}
        </span>
      </div>
      <h3 className="mt-4 font-display text-[21px] leading-tight tracking-[-.03em]">{resource.title}</h3>
      <p className="mt-2 flex-1 text-[12px] leading-5 text-[#687183]">{resource.description}</p>
      <div className={`mt-4 flex items-start gap-2 rounded-lg p-2.5 text-[10px] leading-4 ${needsAttention ? "bg-[#fff1e7] text-[#8d4a38]" : "bg-[#eef3e9] text-[#61705f]"}`}>
        {needsAttention ? <AlertTriangle size={13} className="mt-0.5 shrink-0" /> : <Info size={13} className="mt-0.5 shrink-0" />}
        <span>{monitoringMessage(resource)}</span>
      </div>
      <a
        href={resource.sourceUrl}
        target="_blank"
        rel="noreferrer"
        data-testid={`link-government-resource-${resource.id}`}
        className="mt-4 inline-flex items-center gap-1 border-t border-[#dce0d7] pt-3 text-[11px] font-bold text-[#276047] hover:underline"
      >
        {resource.sourceName} <ExternalLink size={12} />
      </a>
    </article>
  );
}

function useVisaResources({ destinationCountry, passportCountry, purposeTag }: ResourceQueryProps & { purposeTag: ListVisaResourcesPurposeTag }) {
  const params = {
    destinationCountry,
    purposeTag,
    ...(passportCountry ? { passportCountry } : {}),
  };
  return useListVisaResources(
    params,
    {
      query: {
        enabled: Boolean(destinationCountry),
        staleTime: 60_000,
        queryKey: getListVisaResourcesQueryKey(params),
      },
    },
  );
}

function ResourceLoadState({ isLoading, isError }: { isLoading: boolean; isError: boolean }) {
  if (isLoading) {
    return <p role="status" className="rounded-xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-5 text-[12px] text-[#687183]">Loading maintained government source links…</p>;
  }
  if (isError) {
    return <p role="alert" className="rounded-xl border border-[#e7c8ba] bg-[#fff0e9] p-5 text-[12px] text-[#8d4a38]">Government source links are temporarily unavailable. Please retry; the app will not substitute unrelated sources.</p>;
  }
  return null;
}

export function VisaResourceList({
  destinationCountry,
  passportCountry,
  purposeTag,
}: ResourceQueryProps & { purposeTag: ListVisaResourcesPurposeTag }) {
  const query = useVisaResources({ destinationCountry, passportCountry, purposeTag });
  const loadState = <ResourceLoadState isLoading={query.isLoading} isError={query.isError} />;
  if (query.isLoading || query.isError) {
    return <section data-testid="section-government-resources" className="mt-6">{loadState}</section>;
  }
  const resources = query.data?.items ?? [];
  const australiaFinder = destinationCountry === "Australia"
    ? resources.find((resource) => resource.id === "australia-visitor-visa-finder")
    : undefined;
  const listedResources = resources.filter((resource) => resource.id !== australiaFinder?.id);
  return (
    <section data-testid="section-government-resources" className="mt-6">
      <div className="mb-4">
        <div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#47715a]">Maintained government sources · {destinationCountry}</div>
        <h3 className="mt-2 font-display text-2xl tracking-[-.04em]">Official links for this purpose</h3>
        <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#687183]">These maintained links and route examples are not a complete or personalized visa decision. Passport-specific filtering is applied only where an official source record defines it.</p>
      </div>
      {australiaFinder && <aside data-testid="notice-australia-official-finder" className="mb-4 rounded-xl border border-[#d6e4bd] bg-[#f0f6e8] p-4">
        <h4 className="font-label text-[11px] font-bold uppercase tracking-[.08em] text-[#276047]">For the current, answer-driven visa options</h4>
        <p className="mt-2 text-[12px] leading-5 text-[#526457]">Home Affairs changes the options based on your answers about your passport, planned activity, stay and application method. Its results can include more options than Pathfinder’s maintained examples.</p>
        <a href={australiaFinder.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#276047] hover:underline">
          Open {australiaFinder.sourceName} <ExternalLink size={12} />
        </a>
      </aside>}
      {listedResources.length === 0
        ? <p className="rounded-xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-5 text-[12px] leading-5 text-[#687183]">No maintained {purposeTag} source is configured for {destinationCountry} yet. The app will not show work, study, training, business, or visit links from another purpose as a substitute.</p>
        : <div className="grid gap-4 lg:grid-cols-2">{listedResources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>}
      <p className="mt-3 text-[10px] leading-4 text-[#8a919b]">Public links only. Automated checks are enabled only after the source’s access policy is reviewed. A detected page change is held for review; visa facts are never silently replaced.</p>
    </section>
  );
}

export function VisitorVisaOptionsSection({ destinationCountry, passportCountry }: ResourceQueryProps) {
  const query = useVisaResources({ destinationCountry, passportCountry, purposeTag: "visit" });
  if (query.isLoading || query.isError) {
    return (
      <section data-testid="section-visitor-visa-options" className="mb-8">
        <ResourceLoadState isLoading={query.isLoading} isError={query.isError} />
      </section>
    );
  }
  const resources = query.data?.items ?? [];
  const streams = resources.filter((resource) => resource.recordKind === "stream");
  const finders = resources.filter((resource) => resource.recordKind === "finder");

  return (
    <section aria-labelledby="visitor-visa-options-title" data-testid="section-visitor-visa-options" className="mb-8 rounded-2xl border border-[#dce0d7] bg-[#fffdf7] p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="font-label text-[10px] font-bold uppercase tracking-[.15em] text-[#47715a]">Official visitor visa options · {destinationCountry}</div>
          <h2 id="visitor-visa-options-title" className="mt-2 font-display text-3xl tracking-[-.04em]">Visitor pathways to check</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-5 text-[#687183]">These sources are selected for a visit, not from occupation or skills. Check the official page for current conditions and passport-specific options.</p>
        </div>
      </div>
      {streams.length === 0
        ? <div className="mt-5 rounded-xl border border-dashed border-[#c6cfc4] bg-[#eef3e9] p-5 text-[12px] leading-5 text-[#687183]">No reviewed visitor pathways are configured for {destinationCountry} yet. Pathfinder will not reuse Australian or work-visa resources for this trip.</div>
        : <div className="mt-5 grid gap-4 lg:grid-cols-3">{streams.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>}
      {finders.length > 0 && <div className="mt-5">
        <div className="mb-3 font-label text-[10px] font-bold uppercase tracking-[.12em] text-[#47715a]">Official visa guides and checkers</div>
        <div className="grid gap-4 lg:grid-cols-2">{finders.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
      </div>}
    </section>
  );
}
