import type { Endpoint, Parameter } from '@seamapi/blueprint'

/** The parameter that selects a page of results on a paginated endpoint. */
export const pageCursorParameterName = 'page_cursor'

const pageCursorParameter: Parameter = {
  name: pageCursorParameterName,
  description:
    "Identifies the specific page of results to return, obtained from the previous page's next_page_cursor.",
  format: 'string',
  jsonType: 'string',
  isRequired: false,
  isDeprecated: false,
  deprecationMessage: '',
  isUndocumented: false,
  undocumentedMessage: '',
  isDraft: false,
  draftMessage: '',
  hasDefault: false,
}

/**
 * The request parameters for an endpoint, including `page_cursor` for every
 * endpoint that paginates.
 *
 * Every paginated endpoint takes a cursor, yet the API definitions do not
 * always document one, so add it wherever it is missing: without it there is
 * no way to ask for any page but the first.
 */
export const getRequestParameters = (endpoint: Endpoint): Parameter[] => {
  const { parameters } = endpoint.request

  if (!endpoint.hasPagination) return parameters
  if (parameters.some(({ name }) => name === pageCursorParameterName)) {
    return parameters
  }

  return [...parameters, pageCursorParameter]
}
