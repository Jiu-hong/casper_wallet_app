PINNED_TOOLCHAIN := $(shell cat rust-toolchain)

prepare:
	rustup install $(PINNED_TOOLCHAIN)
	rustup target add wasm32-unknown-unknown

build-contract:
	RUSTFLAGS="-C target-cpu=mvp" cargo build --release --target wasm32-unknown-unknown -Z build-std=std,panic_abort
	wasm-strip contract/target/wasm32-unknown-unknown/release/contract.wasm 2>/dev/null | true


clippy:
	cargo clippy --all-targets -- -D warnings

check-lint: clippy
	cargo fmt -- --check

lint: clippy
	cargo fmt

clean:
	cargo clean
