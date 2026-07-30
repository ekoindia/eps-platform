import { ConnectWidget } from "@/components/connect/ConnectWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "react-router-dom";

/**
 * Hosts a single Eko Connect transaction flow, e.g.
 * `/console/transaction/491` for Load E-value.
 *
 * The splat carries the flow's own sub-path so a step is deep-linkable.
 */
const ConnectTransaction = () => {
	const params = useParams();
	const startId = Number(params.startId);
	const rest = params["*"];
	const paths = rest ? rest.split("/").filter(Boolean) : [];

	if (!Number.isFinite(startId) || startId <= 0) {
		return (
			<div className="text-sm">
				<p className="font-medium">That transaction link isn't valid.</p>
				<Link
					to="/console"
					className="mt-2 inline-block underline underline-offset-4"
				>
					Back to console
				</Link>
			</div>
		);
	}

	return (
		<>
			<Helmet>
				<title>Transaction | Eko Console</title>
				<meta name="robots" content="noindex,nofollow" />
			</Helmet>
			{/* Its own boundary: the widget is third-party code that patches global
			    DOM APIs to run, so a failure inside it must degrade to a message here
			    rather than unmount the whole console shell at the app-level boundary. */}
			<ErrorBoundary>
				<ConnectWidget interactionId={startId} paths={paths} />
			</ErrorBoundary>
		</>
	);
};

export default ConnectTransaction;
