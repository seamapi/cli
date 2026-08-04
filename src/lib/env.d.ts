declare global {
  namespace NodeJS {
    interface ProcessEnv {
      INSIDE_WEB_BROWSER?: string
      SEAM_CLI_ENDPOINT?: string
      SEAM_CLI_TOKEN?: string
      SEAM_CLI_WORKSPACE_ID?: string
    }
  }
}

export {}
