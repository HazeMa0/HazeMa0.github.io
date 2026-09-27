(() => {
    const images = [...document.querySelectorAll(".post-content img")]
        .filter(image => !image.closest("a, button") && !image.hasAttribute("data-no-zoom"));
    if (!images.length || typeof HTMLDialogElement === "undefined") return;

    const dialog = document.createElement("dialog");
    dialog.className = "image-zoom-dialog";
    dialog.setAttribute("aria-label", "查看大图");
    dialog.innerHTML = `
        <div class="image-zoom-toolbar">
            <button type="button" class="image-zoom-close" aria-label="关闭图片" title="关闭">✕</button>
        </div>
        <figure>
            <img alt="">
            <figcaption></figcaption>
        </figure>
    `;
    document.body.append(dialog);

    const enlargedImage = dialog.querySelector("img");
    const caption = dialog.querySelector("figcaption");
    let lastTrigger = null;

    dialog.querySelector(".image-zoom-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
        enlargedImage.removeAttribute("src");
        lastTrigger?.focus();
    });

    for (const image of images) {
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "image-zoom-trigger";
        trigger.setAttribute("aria-label", `放大图片：${image.alt || "文章图片"}`);
        image.before(trigger);
        trigger.append(image);

        trigger.addEventListener("click", () => {
            lastTrigger = trigger;
            enlargedImage.src = image.currentSrc || image.src;
            enlargedImage.alt = image.alt;
            const description = image.closest("figure")?.querySelector("figcaption")?.textContent.trim();
            caption.textContent = description || "";
            caption.hidden = !description;
            dialog.showModal();
        });
    }
})();
