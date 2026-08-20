{
  lib,
  stdenv,
  bun,
  buildNpmPackage,
  importNpmLock,
  installShellFiles,
}:

buildNpmPackage {
  pname = "seam";
  # Kept in sync with the version the build injects into the binary.
  version = (lib.importJSON ./package.json).version;

  src = lib.cleanSource ./.;

  npmDeps = importNpmLock { npmRoot = ./.; };
  npmConfigHook = importNpmLock.npmConfigHook;

  # The build script compiles src/bin/cli.ts into a single-file Bun executable.
  nativeBuildInputs = [
    bun
    installShellFiles
  ];
  npmBuildScript = "build:standalone";

  installPhase = ''
    runHook preInstall

    install -Dm755 seam -t $out/bin

    runHook postInstall
  '';

  # The loaders are what `seam completion --install` writes: each one asks the
  # CLI for the real script the first time it completes, so the completions
  # cannot drift from the schema the installed binary carries.
  postInstall = lib.optionalString (stdenv.buildPlatform.canExecute stdenv.hostPlatform) ''
    installShellCompletion --cmd seam \
      --bash <($out/bin/seam completion --loader bash) \
      --fish <($out/bin/seam completion --loader fish) \
      --zsh <($out/bin/seam completion --loader zsh)
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
