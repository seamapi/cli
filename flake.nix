{
  description = "A command-line interface (CLI) for interacting with the Seam API.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      # Every platform Nixpkgs' bun runs on, which is what the build needs.
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      packages = forEachSystem (pkgs: rec {
        seam-cli = pkgs.callPackage ./package.nix { };
        default = seam-cli;
      });
    };
}
