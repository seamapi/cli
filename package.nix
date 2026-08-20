{
  lib,
  bun,
  buildNpmPackage,
  importNpmLock,
}:

buildNpmPackage {
  pname = "seam";
  # Kept in sync with the version the build injects into the binary.
  version = (lib.importJSON ./package.json).version;

  src = lib.cleanSource ./.;

  npmDeps = importNpmLock { npmRoot = ./.; };
  npmConfigHook = importNpmLock.npmConfigHook;

  # The build script compiles src/bin/cli.ts into a single-file Bun executable.
  nativeBuildInputs = [ bun ];
  npmBuildScript = "build:standalone";

  installPhase = ''
    runHook preInstall

    install -Dm755 seam -t $out/bin

    runHook postInstall
  '';

  # The executable is the Bun runtime with the JavaScript bundle appended to
  # it, so anything that rewrites the ELF loses the bundle: stripped, it
  # silently runs as plain Bun; patched by patchelf, it segfaults.
  # buildNpmPackage happens to default dontStrip, but not for this reason.
  dontStrip = true;
  dontPatchELF = true;

  meta = {
    description = "Command-line interface (CLI) for interacting with the Seam API";
    homepage = "https://github.com/seamapi/cli";
    changelog = "https://github.com/seamapi/cli/releases";
    license = lib.licenses.mit;
    mainProgram = "seam";
    # Bun compiles for the host, so this builds wherever Bun itself runs.
    platforms = bun.meta.platforms;
  };
}
