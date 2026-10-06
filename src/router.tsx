import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import App from '@/App'
import { routerSearch } from '@/lib/router-search'
import { appSearchSchema } from '@/lib/search'

const rootRoute = createRootRoute({
  beforeLoad: ({ location }) => {
    const { pathname, searchStr, hash } = location
    if (pathname.length <= 1 || !pathname.endsWith('/')) return
    const stripped = pathname.replace(/\/+$/, '') || '/'
    throw redirect({
      href: `${stripped}${searchStr}${hash ? `#${hash}` : ''}`,
      replace: true,
    })
  },
  errorComponent: function RootError() {
    return (
      <main className="mx-auto grid min-h-svh max-w-[40rem] place-content-center gap-2 p-6">
        <h1 className="text-xl font-semibold">Da ist etwas schiefgelaufen</h1>
        <p className="text-zinc-600">
          Bitte die Seite neu laden. Der Plan steckt weiterhin im Link.
        </p>
      </main>
    )
  },
  component: Outlet,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: appSearchSchema,
  component: App,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  trailingSlash: 'never',
  parseSearch: routerSearch.parse,
  stringifySearch: routerSearch.stringify,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
